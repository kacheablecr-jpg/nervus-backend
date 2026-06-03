import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ThrottlerModule } from '@nestjs/throttler'
import { AuthModule } from './modules/auth/auth.module'
import { ClientsModule } from './modules/clients/clients.module'
import { InvoicesModule } from './modules/invoices/invoices.module'
import { HaciendaModule } from './modules/hacienda/hacienda.module'
import { NervusUser } from './modules/auth/entities/user.entity'
import { NervusClient } from './modules/clients/entities/nervus-client.entity'
import { EmittedDoc } from './modules/invoices/entities/emitted-doc.entity'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        ssl: { rejectUnauthorized: false },
        entities: [NervusUser, NervusClient, EmittedDoc],
        synchronize: false,
        logging: config.get('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    ClientsModule,
    InvoicesModule,
    HaciendaModule,
  ],
})
export class AppModule {}
