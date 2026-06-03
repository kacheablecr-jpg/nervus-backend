import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import { NervusClient } from '../../clients/entities/nervus-client.entity'

export enum DocType {
  FE  = '01',
  TE  = '04',
  NCE = '05',
  NDE = '06',
}

export enum HaciendaStatus {
  PENDING    = 'pending',
  RECIBIDO   = 'recibido',
  PROCESANDO = 'procesando',
  ACEPTADO   = 'aceptado',
  RECHAZADO  = 'rechazado',
  ERROR      = 'error',
}

@Entity('nervus_emitted_docs')
export class EmittedDoc {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'nervus_client_id', type: 'integer' })
  nervusClientId: number

  @ManyToOne(() => NervusClient)
  @JoinColumn({ name: 'nervus_client_id' })
  nervusClient: NervusClient

  // ── Datos de la factura de POS ONE+ ──────────────────────────────────────
  @Column({ name: 'pos_invoice_id', type: 'integer' })
  posInvoiceId: number

  @Column({ name: 'pos_invoice_number', type: 'varchar', length: 50 })
  posInvoiceNumber: string

  @Column({ name: 'pos_total', type: 'decimal', precision: 14, scale: 2 })
  posTotal: number

  @Column({ name: 'pos_date', type: 'timestamp' })
  posDate: Date

  // ── Datos del documento Hacienda ─────────────────────────────────────────
  @Column({ name: 'doc_type', type: 'varchar', length: 2 })
  docType: DocType

  @Column({ name: 'clave', type: 'varchar', length: 50 })
  clave: string

  @Column({ name: 'consecutivo', type: 'varchar', length: 20 })
  consecutivo: string

  @Column({ name: 'xml_signed', type: 'text', nullable: true })
  xmlSigned: string | null

  @Column({ name: 'hacienda_status', type: 'varchar', length: 20, default: HaciendaStatus.PENDING })
  haciendaStatus: HaciendaStatus

  @Column({ name: 'hacienda_message', type: 'text', nullable: true })
  haciendaMessage: string | null

  @Column({ name: 'hacienda_response_xml', type: 'text', nullable: true })
  haciendaResponseXml: string | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @Column({ name: 'emitted_at', type: 'timestamp', nullable: true })
  emittedAt: Date | null
}
