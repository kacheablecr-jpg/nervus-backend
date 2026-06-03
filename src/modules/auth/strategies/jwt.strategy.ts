import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { NervusUser } from '../entities/user.entity'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(NervusUser) private readonly userRepo: Repository<NervusUser>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'nervus-secret',
    })
  }

  async validate(payload: { sub: number; username: string }) {
    const user = await this.userRepo.findOne({ where: { id: payload.sub, active: true } })
    if (!user) throw new UnauthorizedException('Sesión inválida o expirada.')
    return { id: user.id, username: user.username, role: user.role }
  }
}
