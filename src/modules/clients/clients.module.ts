import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ClientsService } from './clients.service'
import { ClientsController } from './clients.controller'
import { NervusClient } from './entities/nervus-client.entity'

@Module({
  imports: [TypeOrmModule.forFeature([NervusClient])],
  providers: [ClientsService],
  controllers: [ClientsController],
  exports: [ClientsService],
})
export class ClientsModule {}
