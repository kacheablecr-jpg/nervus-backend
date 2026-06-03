import { Injectable } from '@nestjs/common'
import { DocType } from '../../invoices/entities/emitted-doc.entity'

@Injectable()
export class ClaveService {
  generarClave(opts: {
    fecha: Date
    cedula: string
    establecimiento: string
    terminal: string
    tipoDoc: DocType
    consecutivo: number
    situacion?: '1' | '2' | '3'
  }): string {
    const d = opts.fecha
    const dd    = String(d.getDate()).padStart(2, '0')
    const mm    = String(d.getMonth() + 1).padStart(2, '0')
    const yy    = String(d.getFullYear()).slice(-2)
    const cedula = opts.cedula.replace(/\D/g, '').padStart(12, '0').slice(-12)
    const estab  = opts.establecimiento.padStart(3, '0').slice(-3)
    const term   = opts.terminal.padStart(5, '0').slice(-5)
    const tipo   = opts.tipoDoc
    const consec = String(opts.consecutivo).padStart(10, '0').slice(-10)
    const sit    = opts.situacion ?? '1'
    const seg    = String(Math.floor(Math.random() * 99999999)).padStart(8, '0')

    const clave = `506${dd}${mm}${yy}${cedula}${estab}${term}${tipo}${consec}${sit}${seg}`
    if (clave.length !== 50) throw new Error(`Clave generada inválida (${clave.length} dígitos): ${clave}`)
    return clave
  }

  generarConsecutivo(opts: {
    establecimiento: string
    terminal: string
    tipoDoc: DocType
    secuencial: number
  }): string {
    return (
      opts.establecimiento.padStart(3, '0').slice(-3) +
      opts.terminal.padStart(5, '0').slice(-5) +
      opts.tipoDoc +
      String(opts.secuencial).padStart(10, '0').slice(-10)
    )
  }
}
