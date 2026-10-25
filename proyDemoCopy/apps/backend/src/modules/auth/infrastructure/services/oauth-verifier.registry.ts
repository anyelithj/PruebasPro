import { Injectable, UnauthorizedException } from '@nestjs/common';
import type {
  IOAuthVerifier,
  IOAuthVerifierRegistry,
} from '../../domain/interfaces/oauth-verifier.interface';
import { GoogleOAuthVerifier } from './google-oauth.verifier';
import { MicrosoftOAuthVerifier } from './microsoft-oauth.verifier';
// [Adapter Registry]: lookup provider → verifier | [Patrón]: Registry + Strategy | [Principio]: OCP

@Injectable()
export class OAuthVerifierRegistry implements IOAuthVerifierRegistry {
  private readonly map: Map<string, IOAuthVerifier>;

  constructor(
    private readonly google: GoogleOAuthVerifier,
    private readonly microsoft: MicrosoftOAuthVerifier,
  ) {
    this.map = new Map<string, IOAuthVerifier>([
      [this.google.provider, this.google],
      [this.microsoft.provider, this.microsoft],
    ]);
  }

  get(provider: string): IOAuthVerifier {
    const v = this.map.get(provider);
    if (!v)
      throw new UnauthorizedException(
        `Provider OAuth '${provider}' no soportado`,
      );
    return v;
  }
}
