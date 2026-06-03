import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm'

export enum HaciendaEnv {
  STAGING    = 'staging',
  PRODUCTION = 'production',
}

export enum IdType {
  FISICA  = '01',
  JURIDICA = '02',
  DIMEX   = '03',
  NITE    = '04',
}

@Entity('nervus_clients')
@Unique(['slug'])
export class NervusClient {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'varchar', length: 100 })
  name: string

  @Column({ type: 'varchar', length: 100 })
  slug: string

  @Column({ name: 'tax_id', type: 'varchar', length: 20 })
  taxId: string

  @Column({ name: 'id_type', type: 'varchar', length: 2, default: IdType.JURIDICA })
  idType: IdType

  @Column({ name: 'company_name', type: 'varchar', length: 255 })
  companyName: string

  @Column({ name: 'economic_activity', type: 'varchar', length: 6 })
  economicActivity: string

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'email' })
  email: string | null

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'phone' })
  phone: string | null

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'address' })
  address: string | null

  @Column({ type: 'varchar', length: 3, default: '1', name: 'provincia' })
  provincia: string

  @Column({ type: 'varchar', length: 3, default: '01', name: 'canton' })
  canton: string

  @Column({ type: 'varchar', length: 3, default: '01', name: 'distrito' })
  distrito: string

  @Column({ type: 'varchar', length: 5, default: '00001', name: 'barrio' })
  barrio: string

  // ── Conexión a POS ONE+ ──────────────────────────────────────────────────
  @Column({ name: 'pos_one_url', type: 'varchar', length: 255 })
  posOneUrl: string

  @Column({ name: 'pos_one_tenant_id', type: 'integer' })
  posOneTenantId: number

  @Column({ name: 'pos_one_admin_user', type: 'varchar', length: 100 })
  posOneAdminUser: string

  @Column({ name: 'pos_one_admin_password', type: 'varchar', length: 255 })
  posOneAdminPassword: string

  // ── Configuración Hacienda ────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 20, default: HaciendaEnv.STAGING, name: 'hacienda_env' })
  haciendaEnv: HaciendaEnv

  @Column({ name: 'atv_user', type: 'varchar', length: 100, nullable: true })
  atvUser: string | null

  @Column({ name: 'atv_password', type: 'varchar', length: 255, nullable: true })
  atvPassword: string | null

  @Column({ name: 'certificate_b64', type: 'text', nullable: true })
  certificateB64: string | null

  @Column({ name: 'certificate_pin', type: 'varchar', length: 255, nullable: true })
  certificatePin: string | null

  @Column({ name: 'establishment', type: 'varchar', length: 3, default: '001' })
  establishment: string

  @Column({ name: 'terminal', type: 'varchar', length: 5, default: '00001' })
  terminal: string

  // ── Consecutivos propios de Nervus ────────────────────────────────────────
  @Column({ name: 'last_fe_seq',  type: 'integer', default: 0 })
  lastFeSeq: number

  @Column({ name: 'last_te_seq',  type: 'integer', default: 0 })
  lastTeSeq: number

  @Column({ name: 'last_nce_seq', type: 'integer', default: 0 })
  lastNceSeq: number

  @Column({ type: 'boolean', default: true, name: 'active' })
  active: boolean

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date
}
