import { NestFactory } from '@nestjs/core'
import { ValidationPipe, Logger } from '@nestjs/common'
import { AppModule } from './app.module'
import * as helmet from 'helmet'
import { DataSource } from 'typeorm'
import * as bcrypt from 'bcrypt'

async function bootstrap() {
  const logger = new Logger('Bootstrap')
  const app = await NestFactory.create(AppModule)

  app.use((helmet as any).default())
  app.enableCors()
  app.setGlobalPrefix('api')
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }))

  // ── Bootstrap DB: crear tablas si no existen ────────────────────────────
  const ds = app.get(DataSource)

  await ds.query(`
    CREATE TABLE IF NOT EXISTS nervus_users (
      id            SERIAL PRIMARY KEY,
      username      VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role          VARCHAR(20)  NOT NULL DEFAULT 'superadmin',
      active        BOOLEAN      NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMP    NOT NULL DEFAULT now(),
      updated_at    TIMESTAMP    NOT NULL DEFAULT now()
    )
  `).catch(() => undefined)

  await ds.query(`
    CREATE TABLE IF NOT EXISTS nervus_clients (
      id                      SERIAL PRIMARY KEY,
      name                    VARCHAR(100)  NOT NULL,
      slug                    VARCHAR(100)  NOT NULL UNIQUE,
      tax_id                  VARCHAR(20)   NOT NULL,
      id_type                 VARCHAR(2)    NOT NULL DEFAULT '02',
      company_name            VARCHAR(255)  NOT NULL,
      economic_activity       VARCHAR(6)    NOT NULL,
      email                   VARCHAR(255),
      phone                   VARCHAR(20),
      address                 VARCHAR(500),
      provincia               VARCHAR(3)    NOT NULL DEFAULT '1',
      canton                  VARCHAR(3)    NOT NULL DEFAULT '01',
      distrito                VARCHAR(3)    NOT NULL DEFAULT '01',
      barrio                  VARCHAR(5)    NOT NULL DEFAULT '00001',
      pos_one_url             VARCHAR(255)  NOT NULL,
      pos_one_tenant_id       INTEGER       NOT NULL,
      pos_one_admin_user      VARCHAR(100)  NOT NULL,
      pos_one_admin_password  VARCHAR(255)  NOT NULL,
      hacienda_env            VARCHAR(20)   NOT NULL DEFAULT 'staging',
      atv_user                VARCHAR(100),
      atv_password            VARCHAR(255),
      certificate_b64         TEXT,
      certificate_pin         VARCHAR(255),
      establishment           VARCHAR(3)    NOT NULL DEFAULT '001',
      terminal                VARCHAR(5)    NOT NULL DEFAULT '00001',
      last_fe_seq             INTEGER       NOT NULL DEFAULT 0,
      last_te_seq             INTEGER       NOT NULL DEFAULT 0,
      last_nce_seq            INTEGER       NOT NULL DEFAULT 0,
      active                  BOOLEAN       NOT NULL DEFAULT TRUE,
      created_at              TIMESTAMP     NOT NULL DEFAULT now(),
      updated_at              TIMESTAMP     NOT NULL DEFAULT now()
    )
  `).catch(() => undefined)

  await ds.query(`
    CREATE TABLE IF NOT EXISTS nervus_emitted_docs (
      id                    SERIAL PRIMARY KEY,
      nervus_client_id      INTEGER      NOT NULL REFERENCES nervus_clients(id),
      pos_invoice_id        INTEGER      NOT NULL,
      pos_invoice_number    VARCHAR(50)  NOT NULL,
      pos_total             DECIMAL(14,2) NOT NULL,
      pos_date              TIMESTAMP    NOT NULL,
      doc_type              VARCHAR(2)   NOT NULL,
      clave                 VARCHAR(50)  NOT NULL,
      consecutivo           VARCHAR(20)  NOT NULL,
      xml_signed            TEXT,
      hacienda_status       VARCHAR(20)  NOT NULL DEFAULT 'pending',
      hacienda_message      TEXT,
      hacienda_response_xml TEXT,
      emitted_at            TIMESTAMP,
      created_at            TIMESTAMP    NOT NULL DEFAULT now()
    )
  `).catch(() => undefined)

  await ds.query(`CREATE INDEX IF NOT EXISTS idx_emitted_docs_client ON nervus_emitted_docs(nervus_client_id)`).catch(() => undefined)
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_emitted_docs_invoice ON nervus_emitted_docs(pos_invoice_id)`).catch(() => undefined)
  await ds.query(`CREATE INDEX IF NOT EXISTS idx_emitted_docs_status ON nervus_emitted_docs(hacienda_status)`).catch(() => undefined)

  // ── Crear superadmin por defecto si no existe ────────────────────────────
  const adminExists = await ds.query(`SELECT id FROM nervus_users WHERE username = 'admin' LIMIT 1`)
  if (!adminExists.length) {
    const hash = await bcrypt.hash('admin2024', 12)
    await ds.query(`INSERT INTO nervus_users (username, password_hash, role) VALUES ('admin', $1, 'superadmin')`, [hash])
    logger.log('Usuario admin creado — cambie la contraseña en producción')
  }

  const port = process.env.PORT ?? 4000
  await app.listen(port)
  logger.log(`Nervus backend corriendo en puerto ${port}`)
}

bootstrap()
