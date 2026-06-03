import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { HttpModule } from '@nestjs/axios'
import { InvoicesService } from './invoices.service'
import { InvoicesController } from './invoices.controller'
import { EmittedDoc } from './entities/emitted-doc.entity'
import { NervusClient } from '../clients/entities/nervus-client.entity'
import { HaciendaModule } from '../hacienda/hacienda.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([EmittedDoc, NervusClient]),
    HttpModule,
    HaciendaModule,
  ],
  providers: [InvoicesService],
  controllers: [InvoicesController],
})
export class InvoicesModule {}
