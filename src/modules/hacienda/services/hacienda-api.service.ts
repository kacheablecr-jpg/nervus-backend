import { Injectable, Logger } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'
import { HaciendaEnv } from '../../clients/entities/nervus-client.entity'

const URLS = {
  [HaciendaEnv.STAGING]: {
    token:     'https://idp.comprobanteselectronicos.go.cr/auth/realms/rut-stag/protocol/openid-connect/token',
    recepcion: 'https://api-sandbox.comprobanteselectronicos.go.cr/recepcion/v1/recepcion',
    clientId:  'api-stag',
  },
  [HaciendaEnv.PRODUCTION]: {
    token:     'https://idp.comprobanteselectronicos.go.cr/auth/realms/rut/protocol/openid-connect/token',
    recepcion: 'https://api.comprobanteselectronicos.go.cr/recepcion/v1/recepcion',
    clientId:  'api-prod',
  },
}

export interface HaciendaResponse {
  ind_estado: 'recibido' | 'procesando' | 'aceptado' | 'rechazado' | 'error'
  respuesta_xml?: string
  mensaje?: string
}

interface HaciendaRawResponse {
  'ind-estado'?: string
  'respuesta-xml'?: string
  'detalle-mensaje'?: string
  ind_estado?: string
  respuesta_xml?: string
}

@Injectable()
export class HaciendaApiService {
  private readonly logger = new Logger(HaciendaApiService.name)

  constructor(private readonly http: HttpService) {}

  async getToken(env: HaciendaEnv, user: string, password: string): Promise<string> {
    const params = new URLSearchParams({
      grant_type: 'password',
      client_id:  URLS[env].clientId,
      username:   user,
      password,
    })
    try {
      const res = await firstValueFrom(
        this.http.post(URLS[env].token, params.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 15000,
        }),
      )
      return res.data.access_token as string
    } catch (err: any) {
      this.logger.error('Error obteniendo token Hacienda', err?.response?.data ?? err.message)
      throw new Error('No se pudo autenticar con Hacienda. Verifique usuario/contraseña ATV.')
    }
  }

  async enviarComprobante(opts: {
    env: HaciendaEnv
    token: string
    clave: string
    fecha: Date
    emisorTipo: string
    emisorCedula: string
    receptorTipo?: string
    receptorCedula?: string
    xmlB64: string
  }): Promise<{ status: number }> {
    const body: Record<string, any> = {
      clave: opts.clave,
      fecha: opts.fecha.toISOString(),
      emisor: {
        tipoIdentificacion: opts.emisorTipo,
        numeroIdentificacion: opts.emisorCedula.replace(/\D/g, ''),
      },
      comprobanteXml: opts.xmlB64,
    }
    if (opts.receptorCedula) {
      body.receptor = {
        tipoIdentificacion: opts.receptorTipo ?? '01',
        numeroIdentificacion: opts.receptorCedula.replace(/\D/g, ''),
      }
    }
    const res = await firstValueFrom(
      this.http.post(URLS[opts.env].recepcion, body, {
        headers: { Authorization: `Bearer ${opts.token}`, 'Content-Type': 'application/json' },
        timeout: 20000,
        validateStatus: () => true,
      }),
    )
    this.logger.log(`Hacienda envío → clave ${opts.clave} → HTTP ${res.status}`)
    return { status: res.status }
  }

  async consultarEstado(env: HaciendaEnv, token: string, clave: string): Promise<HaciendaResponse> {
    const url = `${URLS[env].recepcion}/${clave}`
    const res = await firstValueFrom(
      this.http.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
        validateStatus: () => true,
      }),
    )
    if (res.status === 404) return { ind_estado: 'error', mensaje: 'Clave no encontrada en Hacienda' }
    const raw      = res.data as HaciendaRawResponse
    const indEstado = raw['ind-estado'] ?? raw['ind_estado']
    const respXml   = raw['respuesta-xml'] ?? raw['respuesta_xml']
    const detalle   = raw['detalle-mensaje']
    if (!indEstado) return { ind_estado: 'error', mensaje: `Respuesta inesperada HTTP ${res.status}` }
    return { ind_estado: indEstado as HaciendaResponse['ind_estado'], respuesta_xml: respXml, mensaje: detalle }
  }
}
