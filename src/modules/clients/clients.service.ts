import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { NervusClient } from './entities/nervus-client.entity'
import { CreateClientDto } from './dto/create-client.dto'

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name)

  constructor(
    @InjectRepository(NervusClient) private readonly repo: Repository<NervusClient>,
  ) {}

  findAll() {
    return this.repo.find({ order: { name: 'ASC' } })
  }

  async findOne(id: number) {
    const client = await this.repo.findOne({ where: { id } })
    if (!client) throw new NotFoundException('El cliente no fue encontrado.')
    return client
  }

  async create(dto: CreateClientDto) {
    return this.repo.save(this.repo.create(dto)).catch(e => this.handleDbError(e, 'create'))
  }

  async update(id: number, dto: Partial<CreateClientDto>) {
    const existing = await this.findOne(id)
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = dto as any
    await this.repo.update(id, rest)
    return this.repo.findOneByOrFail({ id })
  }

  async remove(id: number) {
    const existing = await this.findOne(id)
    await this.repo.update(id, { active: false })
  }

  private handleDbError(err: any, context: string): never {
    this.logger.error(`${context}: ${err.message}`, err.stack)
    if (err.code === '23505') {
      if (err.detail?.includes('slug')) throw new BadRequestException('Ya existe un cliente con ese slug.')
      if (err.detail?.includes('tax_id')) throw new BadRequestException('Ya existe un cliente con esa cédula.')
      throw new BadRequestException('Ya existe un cliente con esos datos.')
    }
    throw new BadRequestException('Ocurrió un error al procesar la solicitud. Intente de nuevo.')
  }
}
