import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import jwtConfig from '../../../../shared/config/jwt.config';
import type { JwtPayload } from '../../../../shared/decorators/current-user.decorator';
import { USER_REPOSITORY } from '../../../users/domain/interfaces/user.repository.interface';
import type { IUserRepository } from '../../../users/domain/interfaces/user.repository.interface';
// [Strategy JWT]: extrae + verifica Bearer token | [Patrón]: Strategy (passport) | [Principio]: DIP + OCP | [Paradigma]: POO

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @Inject(jwtConfig.KEY)
    private readonly cfg: ConfigType<typeof jwtConfig>,
    @Inject(USER_REPOSITORY)
    private readonly users: IUserRepository,
  ) {
    // [Configuración del strategy]: extrae de header Authorization: Bearer
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: cfg.accessSecret,
    });
  }

  // [validate]: invocado tras verificar firma+exp, devuelve req.user | [Principio]: SRP
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // [Re-check user activo]: ban inmediato (sesión queda invalidada antes del exp)
    const user = await this.users.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User no longer active');
    }
    // [Retorno]: Nest lo inyecta como request.user (accesible via @CurrentUser)
    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      iat: payload.iat,
      exp: payload.exp,
    };
  }
}
