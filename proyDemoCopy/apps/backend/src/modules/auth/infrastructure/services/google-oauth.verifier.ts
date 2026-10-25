import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import oauthConfig from '../../../../shared/config/oauth.config';
import type {
  IOAuthVerifier,
  VerifiedOAuthProfile,
} from '../../domain/interfaces/oauth-verifier.interface';
// [Adapter Google OAuth]: verifica id_token contra Google JWKS | [Patrón]: Adapter (Hexagonal) | [Principio]: DIP

@Injectable()
export class GoogleOAuthVerifier implements IOAuthVerifier {
  readonly provider = 'google' as const;
  private readonly client: OAuth2Client;

  constructor(
    @Inject(oauthConfig.KEY)
    private readonly cfg: ConfigType<typeof oauthConfig>,
  ) {
    this.client = new OAuth2Client(this.cfg.google.clientId);
  }

  // [verify]: valida firma + audience + expiración usando JWKS de Google
  async verify(idToken: string): Promise<VerifiedOAuthProfile> {
    if (!this.cfg.google.clientId) {
      throw new UnauthorizedException('Google OAuth no está configurado');
    }
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.cfg.google.clientId,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email) {
        throw new UnauthorizedException(
          'id_token de Google sin claims requeridos',
        );
      }
      return {
        sub: payload.sub,
        email: payload.email,
        emailVerified: payload.email_verified === true,
        firstName: payload.given_name,
        lastName: payload.family_name,
        name: payload.name,
        provider: 'google',
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('id_token de Google inválido');
    }
  }
}
