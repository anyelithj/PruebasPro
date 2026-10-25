// [STRATEGY] valida Bearer access token → adjunta UserModel a request.user
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { TOKEN_TYPE_ACCESS } from 'src/common/constants/app.constants';
import { UnauthorizedException } from 'src/common/exceptions/validation.exception';
import { JwtPayload } from 'src/common/interfaces/jwt-payload.interface';
import { UserModel } from 'src/module/user/model/user.model';
import { UserRepository } from 'src/module/user/repository/user.repository';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly users: UserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret') ?? 'change-me',
    });
  }

  async validate(payload: JwtPayload): Promise<UserModel> {
    if (payload.type !== TOKEN_TYPE_ACCESS) {
      throw new UnauthorizedException('Invalid token type');
    }
    const user = await this.users.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }
    return user;
  }
}
