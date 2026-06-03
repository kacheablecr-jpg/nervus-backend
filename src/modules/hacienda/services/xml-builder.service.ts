import { Injectable } from '@nestjs/common'
import { create } from 'xmlbuilder2'
import { DocType } from '../../invoices/entities/emitted-doc.entity'

export interface LineaDetalle {
  numeroLinea: number
  codigo?: string
  cabysCode?: string
  descripcion: string
  cantidad: number
  unidadMedida: string
  precioUnitario: number
  descuento?: number
  subtotal: number
  impuesto?: { codigo: string; tarifa: number; monto: number }
  montoTotal: number
}

export interface EmisorReceptor {
  nombre: string
  tipoIdentificacion: '01' | '02' | '03' | '04'
  identificacion: string
  nombreComercial?: string
  telefono?: string
  correo?: string
  provincia?: string
  canton?: string
  distrito?: string
  barrio?: string
  otrasSenas?: string
}

export interface BuildXmlOpts {
  clave: string
  consecutivo: string
  fechaEmision: Date
  codigoActividad: string
  emisor: EmisorReceptor
  receptor?: EmisorReceptor
  condicionVenta: '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09'
  medioPago: { code: string; otro?: string; total?: number }[]
  detalles: LineaDetalle[]
  totalGravado: number
  totalServGravados?: number
  totalMercGravadas?: number
  totalServExentos?: number
  totalServNoSujetos?: number
  totalExento?: number
  totalNoSujeto?: number
  totalDescuentos?: number
  totalImpuesto: number
  totalVenta: number
  totalVentaNeta: number
  otrosCargos?: { tipo: '01' | '02' | '03' | '04'; detalle: string; monto: number }[]
  totalComprobante: number
  otros?: string
  docRefClave?: string
  docRefConsecutivo?: string
  docRefFecha?: Date
  docRefCodigo?: '01' | '02' | '03' | '04' | '05'
  docRefRazon?: string
}

const ROOT_TAGS: Record<DocType, string> = {
  [DocType.FE]:  'FacturaElectronica',
  [DocType.TE]:  'TiqueteElectronico',
  [DocType.NCE]: 'NotaCreditoElectronica',
  [DocType.NDE]: 'NotaDebitoElectronica',
}

const NS_MAP: Record<DocType, string> = {
  [DocType.FE]:  'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica',
  [DocType.TE]:  'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/tiqueteElectronico',
  [DocType.NCE]: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/notaCreditoElectronica',
  [DocType.NDE]: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/notaDebitoElectronica',
}

function fmtDate(d: Date): string {
  const cr = new Date(d.getTime() - 6 * 60 * 60 * 1000)
  return cr.toISOString().slice(0, 19) + '-06:00'
}

function fmtNum(n: number, decimals = 2): string { return n.toFixed(decimals) }

const CODIGO_TARIFA: Record<number, string> = { 0: '01', 1: '02', 2: '03', 4: '04', 8: '07', 13: '08' }
function codigoTarifa(pct: number): string { return CODIGO_TARIFA[pct] ?? '08' }

@Injectable()
export class XmlBuilderService {
  build(docType: DocType, opts: BuildXmlOpts): string {
    const root = create({ version: '1.0', encoding: 'UTF-8' })
      .ele(ROOT_TAGS[docType], {
        xmlns: NS_MAP[docType],
        'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
        'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      })

    root.ele('Clave').txt(opts.clave)
    root.ele('ProveedorSistemas').txt('Nervus')
    root.ele('CodigoActividadEmisor').txt(opts.codigoActividad)
    root.ele('NumeroConsecutivo').txt(opts.consecutivo)
    root.ele('FechaEmision').txt(fmtDate(opts.fechaEmision))

    const emisorEl = root.ele('Emisor')
    emisorEl.ele('Nombre').txt(opts.emisor.nombre)
    const idEmisor = emisorEl.ele('Identificacion')
    idEmisor.ele('Tipo').txt(opts.emisor.tipoIdentificacion)
    idEmisor.ele('Numero').txt(opts.emisor.identificacion.replace(/\D/g, ''))
    if (opts.emisor.nombreComercial) emisorEl.ele('NombreComercial').txt(opts.emisor.nombreComercial)
    const ubEmisor = emisorEl.ele('Ubicacion')
    ubEmisor.ele('Provincia').txt(opts.emisor.provincia ?? '1')
    ubEmisor.ele('Canton').txt(opts.emisor.canton ?? '01')
    ubEmisor.ele('Distrito').txt(opts.emisor.distrito ?? '01')
    ubEmisor.ele('Barrio').txt(opts.emisor.barrio ?? '00001')
    ubEmisor.ele('OtrasSenas').txt(opts.emisor.otrasSenas ?? 'Costa Rica')
    if (opts.emisor.telefono) {
      const tel = emisorEl.ele('Telefono')
      tel.ele('CodigoPais').txt('506')
      tel.ele('NumTelefono').txt(opts.emisor.telefono.replace(/\D/g, '').slice(-8))
    }
    if (opts.emisor.correo) emisorEl.ele('CorreoElectronico').txt(opts.emisor.correo)

    if (opts.receptor && docType !== DocType.TE) {
      const recEl = root.ele('Receptor')
      recEl.ele('Nombre').txt(opts.receptor.nombre)
      if (opts.receptor.identificacion) {
        const idRec = recEl.ele('Identificacion')
        idRec.ele('Tipo').txt(opts.receptor.tipoIdentificacion)
        idRec.ele('Numero').txt(opts.receptor.identificacion.replace(/\D/g, ''))
      }
      if (opts.receptor.correo) recEl.ele('CorreoElectronico').txt(opts.receptor.correo)
    }

    root.ele('CondicionVenta').txt(opts.condicionVenta)

    const detSrv = root.ele('DetalleServicio')
    for (const linea of opts.detalles) {
      const ln = detSrv.ele('LineaDetalle')
      ln.ele('NumeroLinea').txt(String(linea.numeroLinea))
      ln.ele('CodigoCABYS').txt(linea.cabysCode ?? '0000000000000')
      if (linea.codigo) {
        const cc = ln.ele('CodigoComercial')
        cc.ele('Tipo').txt('04')
        cc.ele('Codigo').txt(linea.codigo)
      }
      ln.ele('Cantidad').txt(fmtNum(linea.cantidad, 3))
      ln.ele('UnidadMedida').txt(linea.unidadMedida)
      ln.ele('Detalle').txt(linea.descripcion)
      ln.ele('PrecioUnitario').txt(fmtNum(linea.precioUnitario))
      ln.ele('MontoTotal').txt(fmtNum(linea.subtotal))
      if (linea.descuento && linea.descuento > 0) {
        const desc = ln.ele('Descuento')
        desc.ele('MontoDescuento').txt(fmtNum(linea.descuento))
        desc.ele('NaturalezaDescuento').txt('Descuento comercial')
      }
      const subtotalNeto = linea.subtotal - (linea.descuento ?? 0)
      ln.ele('SubTotal').txt(fmtNum(subtotalNeto))
      ln.ele('BaseImponible').txt(fmtNum(subtotalNeto))
      if (linea.impuesto) {
        const imp = ln.ele('Impuesto')
        imp.ele('Codigo').txt(linea.impuesto.codigo)
        imp.ele('CodigoTarifaIVA').txt(codigoTarifa(linea.impuesto.tarifa))
        imp.ele('Tarifa').txt(fmtNum(linea.impuesto.tarifa))
        imp.ele('Monto').txt(fmtNum(linea.impuesto.monto))
        ln.ele('ImpuestoAsumidoEmisorFabrica').txt('0.00')
        ln.ele('ImpuestoNeto').txt(fmtNum(linea.impuesto.monto))
      }
      ln.ele('MontoTotalLinea').txt(fmtNum(linea.montoTotal))
    }

    if (opts.otrosCargos?.length) {
      for (const cargo of opts.otrosCargos) {
        const oc = root.ele('OtrosCargos')
        oc.ele('TipoDocumentoOC').txt(cargo.tipo)
        oc.ele('Detalle').txt(cargo.detalle)
        oc.ele('MontoCargo').txt(fmtNum(cargo.monto))
      }
    }

    const resumen = root.ele('ResumenFactura')
    const moneda  = resumen.ele('CodigoTipoMoneda')
    moneda.ele('CodigoMoneda').txt('CRC')
    moneda.ele('TipoCambio').txt('1.00')
    const totalServGravados = opts.totalServGravados ?? opts.totalGravado
    if (totalServGravados > 0) resumen.ele('TotalServGravados').txt(fmtNum(totalServGravados))
    if ((opts.totalServExentos ?? 0) > 0) resumen.ele('TotalServExentos').txt(fmtNum(opts.totalServExentos!))
    if ((opts.totalServNoSujetos ?? 0) > 0) resumen.ele('TotalServNoSujetos').txt(fmtNum(opts.totalServNoSujetos!))
    if (opts.totalMercGravadas) resumen.ele('TotalMercanciasGravadas').txt(fmtNum(opts.totalMercGravadas))
    if (opts.totalGravado > 0) resumen.ele('TotalGravado').txt(fmtNum(opts.totalGravado))
    if ((opts.totalExento ?? 0) > 0) resumen.ele('TotalExento').txt(fmtNum(opts.totalExento!))
    if ((opts.totalNoSujeto ?? 0) > 0) resumen.ele('TotalNoSujeto').txt(fmtNum(opts.totalNoSujeto!))
    resumen.ele('TotalVenta').txt(fmtNum(opts.totalVenta))
    if (opts.totalDescuentos) resumen.ele('TotalDescuentos').txt(fmtNum(opts.totalDescuentos))
    resumen.ele('TotalVentaNeta').txt(fmtNum(opts.totalVentaNeta))

    const impMap = new Map<string, { codigo: string; codigoTarifa: string; total: number }>()
    for (const linea of opts.detalles) {
      if (linea.impuesto && linea.impuesto.monto > 0) {
        const ct  = codigoTarifa(linea.impuesto.tarifa ?? 0)
        const key = `${linea.impuesto.codigo ?? '01'}_${ct}`
        const ex  = impMap.get(key)
        if (ex) { ex.total += linea.impuesto.monto }
        else    { impMap.set(key, { codigo: linea.impuesto.codigo ?? '01', codigoTarifa: ct, total: linea.impuesto.monto }) }
      }
    }
    for (const imp of impMap.values()) {
      const desg = resumen.ele('TotalDesgloseImpuesto')
      desg.ele('Codigo').txt(imp.codigo)
      desg.ele('CodigoTarifaIVA').txt(imp.codigoTarifa)
      desg.ele('TotalMontoImpuesto').txt(fmtNum(imp.total))
    }
    resumen.ele('TotalImpuesto').txt(fmtNum(opts.totalImpuesto))
    const totalOtrosCargos = opts.otrosCargos?.reduce((s, c) => s + c.monto, 0) ?? 0
    if (totalOtrosCargos > 0) resumen.ele('TotalOtrosCargos').txt(fmtNum(totalOtrosCargos))
    for (const mp of opts.medioPago) {
      const mpEl = resumen.ele('MedioPago')
      mpEl.ele('TipoMedioPago').txt(mp.code)
      if (mp.code === '99' && mp.otro) mpEl.ele('MedioPagoOtros').txt(mp.otro)
      if (mp.total != null) mpEl.ele('TotalMedioPago').txt(fmtNum(mp.total))
    }
    resumen.ele('TotalComprobante').txt(fmtNum(opts.totalComprobante))

    if (opts.docRefClave) {
      const ref = root.ele('InformacionReferencia')
      ref.ele('TipoDocIR').txt(opts.docRefClave.substring(29, 31))
      ref.ele('Numero').txt(opts.docRefClave)
      ref.ele('FechaEmisionIR').txt(fmtDate(opts.docRefFecha ?? new Date()))
      ref.ele('Codigo').txt(opts.docRefCodigo ?? '01')
      ref.ele('Razon').txt(opts.docRefRazon ?? 'Anulación')
    }

    if (opts.otros) root.ele('Otros').txt(opts.otros)
    return root.end({ prettyPrint: false })
  }
}
