import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import jwtConfig from '../../../../shared/config/jwt.config';
import type {
  IssueTokenInput,
  ITokenService,
} from '../../domain/interfaces/token.service.interface';
import type { TokenPair } from '../../domain/value-objects/token-pair.vo';
// [Adapter JWT]: implementa ITokenService usando @nestjs/jwt | [Patrón]: Adapter (Hexagonal) | [Principio]: DIP | [Paradigma]: POO

@Injectable()
export class JwtTokenService implements ITokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(jwtConfig.KEY)
    private readonly cfg: ConfigType<typeof jwtConfig>,
  ) {}

  // [issuePair]: firma access + refresh con secrets distintos | [Principio]: SRP
  async issuePair(input: IssueTokenInput): Promise<TokenPair> {
    // [Claims access]: cortos + role para guards sin DB round-trip
    // [Cast vía unknown→number]: el tipo StringValue de 'ms' rechaza string genérico, pero "15m" es válido en runtime
    const accessToken = await this.jwt.signAsync(
      { sub: input.userId, email: input.email, role: input.role },
      {
        secret: this.cfg.accessSecret,
        expiresIn: this.cfg.accessExpiresIn as unknown as number,
      },
    );
    // [Refresh con secret distinto]: minimiza impacto si access secret se filtra
    const refreshToken = await this.jwt.signAsync(
      { sub: input.userId, email: input.email, role: input.role },
      {
        secret: this.cfg.refreshSecret,
        expiresIn: this.cfg.refreshExpiresIn as unknown as number,
      },
    );

    // [Decodificar exp del access]: pasarlo al cliente en segundos relativos
    // `decode<T>` (@nestjs/jwt): genérico → `exp`/`iat` tipados en vez de `any` | [Principio]: tipado seguro
    const decoded = this.jwt.decode<{ exp: number; iat: number }>(accessToken);
    const accessExpiresIn = decoded.exp - decoded.iat;

    return {
      accessToken,
      refreshToken,
      accessExpiresIn,
      tokenType: 'Bearer',
    };
  }

  // [verifyRefresh]: valida firma + expiración usando refresh secret | [Principio]: SRP
  async verifyRefresh(
    token: string,
  ): Promise<IssueTokenInput & { exp: number }> {
    const payload = await this.jwt.verifyAsync<{
      sub: string;
      email: string;
      role: IssueTokenInput['role'];
      exp: number;
    }>(token, { secret: this.cfg.refreshSecret });

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      exp: payload.exp,
    };
  }

  // [hashRefresh]: SHA-256 del refresh para guardarlo en DB sin almacenar el JWT en claro
  hashRefresh(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
