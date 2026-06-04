import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource } from 'typeorm'
import { HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'
import { EmittedDoc, DocType, HaciendaStatus } from './entities/emitted-doc.entity'
import { NervusClient } from '../clients/entities/nervus-client.entity'
import { ClaveService } from '../hacienda/services/clave.service'
import { SignerService } from '../hacienda/services/signer.service'
import { XmlBuilderService } from '../hacienda/services/xml-builder.service'
import { HaciendaApiService } from '../hacienda/services/hacienda-api.service'
import { EmitInvoicesDto } from './dto/emit-invoices.dto'

interface PosInvoice {
  id: number
  invoiceNumber: string
  status: string
  total: number
  subtotal: number
  taxAmount: number
  discount: number
  serviceCharge: number
  createdAt: string
  paymentMethods?: { code: string; amount: number }[]
  details?: {
    id: number
    description: string
    quantity: number
    unitPrice: number
    subtotal: number
    discount: number
    taxAmount: number
    taxPercentage: number
    total: number
    article?: { code: string; cabysCode: string; unitMeasure: string }
  }[]
  client?: { name: string; taxId: string; idType: string; email: string }
}

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name)

  constructor(
    @InjectRepository(EmittedDoc) private readonly docRepo: Repository<EmittedDoc>,
    @InjectRepository(NervusClient) private readonly clientRepo: Repository<NervusClient>,
    private readonly dataSource: DataSource,
    private readonly http: HttpService,
    private readonly claveService: ClaveService,
    private readonly signerService: SignerService,
    private readonly xmlBuilderService: XmlBuilderService,
    private readonly haciendaApiService: HaciendaApiService,
  ) {}

  // ── Importar facturas de POS ONE+ ─────────────────────────────────────────
  async importFromPosOne(clientId: number, from: string, to: string) {
    const client = await this.getClient(clientId)
    const token  = await this.getPosOneToken(client)

    const res = await firstValueFrom(
      this.http.get(`${client.posOneUrl}/api/invoices`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { from, to, tenantId: client.posOneTenantId, limit: 500 },
        timeout: 30000,
        validateStatus: () => true,
      }),
    )

    if (res.status !== 200) {
      throw new BadRequestException(`Error al consultar POS ONE+: HTTP ${res.status}`)
    }

    // POS ONE+ devuelve { items: [...] } o array directo
    const invoices: PosInvoice[] = Array.isArray(res.data)
      ? res.data
      : (res.data?.items ?? res.data?.data ?? [])

    const alreadyEmitted = await this.docRepo.find({
      where: { nervusClientId: clientId },
      select: { posInvoiceId: true } as any,
    })
    const emittedIds = new Set(alreadyEmitted.map(d => d.posInvoiceId))

    return invoices
      .filter(inv => inv.status === 'COMPLETADA' || inv.status === 'ISSUED' || inv.status === 'EMITIDA')
      .map(inv => ({
        id:            inv.id,
        invoiceNumber: inv.invoiceNumber,
        total:         Number(inv.total),
        subtotal:      Number(inv.subtotal),
        taxAmount:     Number((inv as any).tax ?? inv.taxAmount ?? 0),
        createdAt:     (inv as any).date ?? inv.createdAt,
        paymentMethods: (inv as any).payments ?? inv.paymentMethods ?? [],
        client:        inv.client
          ? { name: (inv.client as any).fullName ?? (inv.client as any).name, taxId: (inv.client as any).taxId, idType: (inv.client as any).idType, email: (inv.client as any).email }
          : undefined,
        autoSelected:  ((inv as any).payments ?? inv.paymentMethods ?? []).some((p: any) => p.code === 'TAR' || p.code === '04' || p.paymentMethod?.code === 'TAR'),
        alreadyEmitted: emittedIds.has(inv.id),
      }))
  }

  // ── Emitir documentos a Hacienda ──────────────────────────────────────────
  async emitInvoices(dto: EmitInvoicesDto) {
    const client = await this.getClient(dto.clientId)

    if (!client.atvUser || !client.atvPassword || !client.certificateB64 || !client.certificatePin) {
      throw new BadRequestException('El cliente no tiene configuración de Hacienda completa.')
    }

    const posToken = await this.getPosOneToken(client)
    const results: { invoiceId: number; invoiceNumber: string; status: string; message?: string }[] = []

    for (const invoiceId of dto.invoiceIds) {
      try {
        const result = await this.emitSingle(client, posToken, invoiceId, dto.docType)
        results.push(result)
      } catch (err: any) {
        this.logger.error(`Error emitiendo factura ${invoiceId}: ${err.message}`)
        results.push({ invoiceId, invoiceNumber: '', status: 'error', message: err.message })
      }
    }

    return results
  }

  private async emitSingle(client: NervusClient, posToken: string, invoiceId: number, docType: DocType) {
    // Verificar que no se haya emitido antes
    const existing = await this.docRepo.findOne({
      where: { nervusClientId: client.id, posInvoiceId: invoiceId },
    })
    if (existing) {
      return { invoiceId, invoiceNumber: existing.posInvoiceNumber, status: existing.haciendaStatus, message: 'Ya emitida anteriormente' }
    }

    // Obtener detalle completo de la factura de POS ONE+
    const res = await firstValueFrom(
      this.http.get(`${client.posOneUrl}/api/invoices/${invoiceId}`, {
        headers: { Authorization: `Bearer ${posToken}` },
        timeout: 15000,
        validateStatus: () => true,
      }),
    )
    if (res.status !== 200) throw new Error(`No se pudo obtener la factura ${invoiceId} de POS ONE+`)
    const inv: PosInvoice = res.data

    // ── Generar consecutivo y clave en transacción ────────────────────────
    const { clave, consecutivo, emittedDoc } = await this.dataSource.transaction(async (manager) => {
      const clientLocked = await manager.findOne(NervusClient, {
        where: { id: client.id },
        lock: { mode: 'pessimistic_write' },
      })
      if (!clientLocked) throw new Error('Cliente no encontrado')

      const seqField = docType === DocType.FE ? 'lastFeSeq' : 'lastTeSeq'
      const nextSeq  = clientLocked[seqField] + 1
      await manager.update(NervusClient, client.id, { [seqField]: nextSeq })

      const clave = this.claveService.generarClave({
        fecha:           new Date(inv.createdAt),
        cedula:          client.taxId,
        establecimiento: client.establishment,
        terminal:        client.terminal,
        tipoDoc:         docType,
        consecutivo:     nextSeq,
      })

      const consecutivo = this.claveService.generarConsecutivo({
        establecimiento: client.establishment,
        terminal:        client.terminal,
        tipoDoc:         docType,
        secuencial:      nextSeq,
      })

      const doc = manager.create(EmittedDoc, {
        nervusClientId:  client.id,
        posInvoiceId:    inv.id,
        posInvoiceNumber: inv.invoiceNumber,
        posTotal:        inv.total,
        posDate:         new Date((inv as any).date ?? inv.createdAt),
        docType,
        clave,
        consecutivo,
        haciendaStatus:  HaciendaStatus.PENDING,
      })
      const emittedDoc = await manager.save(EmittedDoc, doc)
      return { clave, consecutivo, emittedDoc }
    })

    // ── Construir XML ────────────────────────────────────────────────────
    const detalles = (inv.details ?? []).map((d, i) => ({
      numeroLinea:   i + 1,
      codigo:        d.article?.code,
      cabysCode:     d.article?.cabysCode,
      descripcion:   d.description,
      cantidad:      d.quantity,
      unidadMedida:  d.article?.unitMeasure ?? 'Sp',
      precioUnitario: d.unitPrice,
      descuento:     d.discount > 0 ? d.discount : undefined,
      subtotal:      d.subtotal,
      impuesto:      d.taxPercentage > 0 ? { codigo: '01', tarifa: d.taxPercentage, monto: d.taxAmount } : undefined,
      montoTotal:    d.total,
    }))

    const paymentMethods = (inv.paymentMethods ?? []).map(p => ({ code: p.code, total: p.amount }))
    if (!paymentMethods.length) paymentMethods.push({ code: '01', total: inv.total })

    const condicion: '01' | '02' = '01'
    const receptor = inv.client?.taxId ? {
      nombre:            inv.client.name ?? 'Consumidor Final',
      tipoIdentificacion: (inv.client.idType ?? '01') as '01' | '02' | '03' | '04',
      identificacion:    inv.client.taxId,
      correo:            inv.client.email,
    } : undefined

    const xmlUnsigned = this.xmlBuilderService.build(docType, {
      clave,
      consecutivo,
      fechaEmision:    new Date(inv.createdAt),
      codigoActividad: client.economicActivity,
      emisor: {
        nombre:            client.companyName,
        tipoIdentificacion: client.idType,
        identificacion:    client.taxId,
        correo:            client.email ?? undefined,
        telefono:          client.phone ?? undefined,
        provincia:         client.provincia,
        canton:            client.canton,
        distrito:          client.distrito,
        barrio:            client.barrio,
        otrasSenas:        client.address ?? 'Costa Rica',
      },
      receptor,
      condicionVenta:  condicion,
      medioPago:       paymentMethods,
      detalles,
      totalGravado:    inv.subtotal,
      totalServGravados: inv.subtotal,
      totalImpuesto:   inv.taxAmount,
      totalVenta:      inv.subtotal,
      totalDescuentos: inv.discount > 0 ? inv.discount : undefined,
      totalVentaNeta:  inv.subtotal - (inv.discount ?? 0),
      otrosCargos:     inv.serviceCharge > 0 ? [{ tipo: '03' as const, detalle: 'Cargo de servicio', monto: inv.serviceCharge }] : undefined,
      totalComprobante: inv.total,
    })

    // ── Firmar XML ────────────────────────────────────────────────────────
    const xmlSigned = this.signerService.sign(xmlUnsigned, client.certificateB64!, client.certificatePin!)
    const xmlB64    = Buffer.from(xmlSigned, 'utf-8').toString('base64')

    // ── Enviar a Hacienda ─────────────────────────────────────────────────
    const haciendaToken = await this.haciendaApiService.getToken(client.haciendaEnv, client.atvUser!, client.atvPassword!)
    await this.haciendaApiService.enviarComprobante({
      env:            client.haciendaEnv,
      token:          haciendaToken,
      clave,
      fecha:          new Date((inv as any).date ?? inv.createdAt),
      emisorTipo:     client.idType,
      emisorCedula:   client.taxId,
      receptorTipo:   receptor?.tipoIdentificacion,
      receptorCedula: receptor?.identificacion,
      xmlB64,
    })

    await this.docRepo.update(emittedDoc.id, {
      xmlSigned,
      haciendaStatus: HaciendaStatus.RECIBIDO,
      emittedAt: new Date(),
    })

    return { invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, status: HaciendaStatus.RECIBIDO }
  }

  // ── Historial de documentos emitidos ─────────────────────────────────────
  async findAll(clientId: number, page = 1, pageSize = 50) {
    const [docs, total] = await this.docRepo.findAndCount({
      where: { nervusClientId: clientId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })
    return { data: docs, total, page, pageSize }
  }

  async findOne(id: number) {
    const doc = await this.docRepo.findOne({ where: { id }, relations: { nervusClient: true } as any })
    if (!doc) throw new NotFoundException('El documento no fue encontrado.')
    return doc
  }

  // ── Consultar estado en Hacienda ──────────────────────────────────────────
  async checkStatus(id: number) {
    const doc    = await this.findOne(id)
    const client = doc.nervusClient
    if (!client.atvUser || !client.atvPassword) throw new BadRequestException('Configuración Hacienda incompleta.')
    const token  = await this.haciendaApiService.getToken(client.haciendaEnv, client.atvUser, client.atvPassword)
    const result = await this.haciendaApiService.consultarEstado(client.haciendaEnv, token, doc.clave)
    await this.docRepo.update(id, {
      haciendaStatus: result.ind_estado as HaciendaStatus,
      haciendaMessage: result.mensaje ?? null,
      haciendaResponseXml: result.respuesta_xml ?? null,
    })
    return { ...doc, haciendaStatus: result.ind_estado, haciendaMessage: result.mensaje }
  }

  // ── Helpers privados ──────────────────────────────────────────────────────
  private async getClient(clientId: number) {
    const client = await this.clientRepo.findOne({ where: { id: clientId, active: true } })
    if (!client) throw new NotFoundException('El cliente no fue encontrado.')
    return client
  }

  private async getPosOneToken(client: NervusClient): Promise<string> {
    const res = await firstValueFrom(
      this.http.post(`${client.posOneUrl}/api/auth/login`, {
        username: client.posOneAdminUser,
        password: client.posOneAdminPassword,
      }, { timeout: 10000, validateStatus: () => true }),
    )
    const token = res.data?.accessToken ?? res.data?.access_token
    if (res.status !== 200 || !token) {
      throw new BadRequestException('No se pudo autenticar con POS ONE+. Verifique credenciales.')
    }
    return token as string
  }
}
