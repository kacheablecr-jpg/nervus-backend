import { IsString, IsNotEmpty, IsEmail, IsOptional, IsNumber, IsEnum, IsUrl } from 'class-validator'
import { HaciendaEnv, IdType } from '../entities/nervus-client.entity'

export class CreateClientDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  name: string

  @IsString()
  @IsNotEmpty({ message: 'El slug es obligatorio.' })
  slug: string

  @IsString()
  @IsNotEmpty({ message: 'La cédula jurídica es obligatoria.' })
  taxId: string

  @IsEnum(IdType, { message: 'El tipo de identificación no es válido.' })
  @IsOptional()
  idType?: IdType

  @IsString()
  @IsNotEmpty({ message: 'El nombre de la empresa es obligatorio.' })
  companyName: string

  @IsString()
  @IsNotEmpty({ message: 'La actividad económica es obligatoria.' })
  economicActivity: string

  @IsEmail({}, { message: 'El correo no tiene un formato válido.' })
  @IsOptional()
  email?: string

  @IsString()
  @IsOptional()
  phone?: string

  @IsString()
  @IsOptional()
  address?: string

  @IsString()
  @IsOptional()
  provincia?: string

  @IsString()
  @IsOptional()
  canton?: string

  @IsString()
  @IsOptional()
  distrito?: string

  @IsString()
  @IsOptional()
  barrio?: string

  // Conexión POS ONE+
  @IsString()
  @IsNotEmpty({ message: 'La URL de POS ONE+ es obligatoria.' })
  posOneUrl: string

  @IsNumber()
  posOneTenantId: number

  @IsString()
  @IsNotEmpty({ message: 'El usuario de POS ONE+ es obligatorio.' })
  posOneAdminUser: string

  @IsString()
  @IsNotEmpty({ message: 'La contraseña de POS ONE+ es obligatoria.' })
  posOneAdminPassword: string

  // Hacienda
  @IsEnum(HaciendaEnv, { message: 'El ambiente de Hacienda no es válido.' })
  @IsOptional()
  haciendaEnv?: HaciendaEnv

  @IsString()
  @IsOptional()
  atvUser?: string

  @IsString()
  @IsOptional()
  atvPassword?: string

  @IsString()
  @IsOptional()
  certificateB64?: string

  @IsString()
  @IsOptional()
  certificatePin?: string

  @IsString()
  @IsOptional()
  establishment?: string

  @IsString()
  @IsOptional()
  terminal?: string
}
