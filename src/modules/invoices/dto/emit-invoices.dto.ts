import { IsArray, IsNumber, IsNotEmpty, IsEnum, IsOptional } from 'class-validator'
import { DocType } from '../entities/emitted-doc.entity'

export class EmitInvoicesDto {
  @IsNumber()
  clientId: number

  @IsArray()
  @IsNotEmpty({ message: 'Debe seleccionar al menos una factura.' })
  invoiceIds: number[]

  @IsEnum(DocType, { message: 'El tipo de documento no es válido (01=FE, 04=TE).' })
  docType: DocType
}
