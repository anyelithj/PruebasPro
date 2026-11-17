import { Injectable, UnauthorizedException } from '@nestjs/common';
import type {
  IOAuthVerifier,
  IOAuthVerifierRegistry,
} from '../../domain/interfaces/oauth-verifier.interface';
import { GoogleOAuthVerifier } from './google-oauth.verifier';
// [Adapter Registry]: lookup provider → verifier | [Patrón]: Registry + Strategy | [Principio]: OCP
// [2026-11-16]: Microsoft retirado → solo Google; otro proveedor = nuevo verifier + una entrada en el Map

@Injectable()
export class OAuthVerifierRegistry implements IOAuthVerifierRegistry {
  private readonly map: Map<string, IOAuthVerifier>;

  constructor(private readonly google: GoogleOAuthVerifier) {
    this.map = new Map<string, IOAuthVerifier>([
      [this.google.provider, this.google],
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
