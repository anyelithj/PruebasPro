// [SRP][FP] creación y verificación de tokens — access + refresh con jti para rotación
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { TOKEN_TYPE_ACCESS, TOKEN_TYPE_REFRESH } from 'src/common/constants/app.constants';
import { JwtPayload } from 'src/common/interfaces/jwt-payload.interface';
import { UserModel } from 'src/module/user/model/user.model';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshJti: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async createAccessToken(user: UserModel): Promise<string> {
    return this.jwt.signAsync(
      { sub: user.id, role: user.role, type: TOKEN_TYPE_ACCESS },
      {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: this.config.get<string>('jwt.accessTtl'),
      },
    );
  }

  async createTokenPair(user: UserModel): Promise<TokenPair> {
    const jti = randomUUID();
    const refreshTtl = this.config.get<string>('jwt.refreshTtl') ?? '7d';
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, type: TOKEN_TYPE_REFRESH, jti },
      { secret: this.config.get<string>('jwt.refreshSecret'), expiresIn: refreshTtl },
    );
    return {
      accessToken: await this.createAccessToken(user),
      refreshToken,
      refreshJti: jti,
      refreshExpiresAt: this.expiryFromNow(refreshTtl),
    };
  }

  async verifyRefresh(token: string): Promise<JwtPayload> {
    return this.jwt.verifyAsync<JwtPayload>(token, {
      secret: this.config.get<string>('jwt.refreshSecret'),
    });
  }

  // Traduce "7d" / "15m" / "3600" a un Date aproximado para persistir expires_at.
  private expiryFromNow(ttl: string): Date {
    const match = /^(\d+)([smhd])?$/.exec(ttl.trim());
    const now = Date.now();
    if (!match) {
      return new Date(now + 7 * 86400_000);
    }
    const value = parseInt(match[1], 10);
    const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] ?? 's'] ?? 1000;
    return new Date(now + value * unitMs);
  }
}
