import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { ClaveService } from './services/clave.service'
import { SignerService } from './services/signer.service'
import { HaciendaApiService } from './services/hacienda-api.service'
import { XmlBuilderService } from './services/xml-builder.service'

@Module({
  imports: [HttpModule],
  providers: [ClaveService, SignerService, HaciendaApiService, XmlBuilderService],
  exports: [ClaveService, SignerService, HaciendaApiService, XmlBuilderService],
})
export class HaciendaModule {}
