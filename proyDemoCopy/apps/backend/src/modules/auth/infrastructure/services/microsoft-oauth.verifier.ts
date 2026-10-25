import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import oauthConfig from '../../../../shared/config/oauth.config';
import type {
  IOAuthVerifier,
  VerifiedOAuthProfile,
} from '../../domain/interfaces/oauth-verifier.interface';
// [Adapter Microsoft OAuth]: verifica id_token contra Microsoft Entra JWKS | [Patrón]: Adapter (Hexagonal) | [Principio]: DIP

@Injectable()
export class MicrosoftOAuthVerifier implements IOAuthVerifier {
  readonly provider = 'microsoft' as const;
  private readonly jwks: JWTVerifyGetKey;
  private readonly issuer: string;

  constructor(
    @Inject(oauthConfig.KEY)
    private readonly cfg: ConfigType<typeof oauthConfig>,
  ) {
    const tenant = this.cfg.microsoft.tenantId;
    this.jwks = createRemoteJWKSet(
      new URL(
        `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`,
      ),
    );
    this.issuer = `https://login.microsoftonline.com/${tenant}/v2.0`;
  }

  // [verify]: valida firma JWKS + issuer + audience
  async verify(idToken: string): Promise<VerifiedOAuthProfile> {
    if (!this.cfg.microsoft.clientId) {
      throw new UnauthorizedException('Microsoft OAuth no está configurado');
    }
    try {
      const { payload } = await jwtVerify(idToken, this.jwks, {
        issuer: this.issuer,
        audience: this.cfg.microsoft.clientId,
      });
      const sub = typeof payload.sub === 'string' ? payload.sub : undefined;
      // [Email fallback]: Entra puede no emitir email — usa preferred_username (UPN)
      const email =
        (typeof payload.email === 'string' && payload.email) ||
        (typeof payload.preferred_username === 'string' &&
          payload.preferred_username) ||
        undefined;
      if (!sub || !email) {
        throw new UnauthorizedException(
          'id_token de Microsoft sin claims requeridos',
        );
      }
      const name = typeof payload.name === 'string' ? payload.name : undefined;
      const [firstName, ...rest] = (name ?? '').split(' ').filter(Boolean);
      return {
        sub,
        email: email.toLowerCase(),
        emailVerified: true,
        firstName: firstName,
        lastName: rest.join(' ') || undefined,
        name,
        provider: 'microsoft',
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('id_token de Microsoft inválido');
    }
  }
}
