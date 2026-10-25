// [STRATEGY] valida refresh token (secret distinto) — usado en rotación
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { TOKEN_TYPE_REFRESH } from 'src/common/constants/app.constants';
import { UnauthorizedException } from 'src/common/exceptions/validation.exception';
import { JwtPayload } from 'src/common/interfaces/jwt-payload.interface';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.refreshSecret') ?? 'change-me-refresh',
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    if (payload.type !== TOKEN_TYPE_REFRESH) {
      throw new UnauthorizedException('Invalid token type');
    }
    return payload;
  }
}
