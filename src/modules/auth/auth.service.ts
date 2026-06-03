import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as bcrypt from 'bcrypt'
import { NervusUser } from './entities/user.entity'
import { LoginDto } from './dto/login.dto'

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(NervusUser) private readonly userRepo: Repository<NervusUser>,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({ where: { username: dto.username, active: true } })
    if (!user) throw new UnauthorizedException('Usuario o contraseña incorrectos.')

    const valid = await bcrypt.compare(dto.password, user.passwordHash)
    if (!valid) throw new UnauthorizedException('Usuario o contraseña incorrectos.')

    const token = this.jwtService.sign({ sub: user.id, username: user.username, role: user.role })
    return { access_token: token, user: { id: user.id, username: user.username, role: user.role } }
  }

  async createUser(username: string, password: string, role = 'superadmin') {
    const existing = await this.userRepo.findOne({ where: { username } })
    if (existing) throw new BadRequestException('El usuario ya existe.')
    const hash = await bcrypt.hash(password, 12)
    const user = this.userRepo.create({ username, passwordHash: hash, role })
    return this.userRepo.save(user)
  }
}
