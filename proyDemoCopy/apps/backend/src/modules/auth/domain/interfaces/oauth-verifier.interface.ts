// [Port OAuth verifier]: contrato verificación de id_token | [Patrón]: Port (Hexagonal) | [Principio]: DIP + ISP | [Paradigma]: POO

// [DI Token]: provider key para inyectar implementación concreta
export const OAUTH_VERIFIER_REGISTRY = Symbol('OAUTH_VERIFIER_REGISTRY');

// [Claims verificados]: forma normalizada cross-provider
export interface VerifiedOAuthProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  firstName?: string;
  lastName?: string;
  name?: string;
  provider: 'google' | 'microsoft';
}

// [Contrato verifier]: cada provider implementa esta interfaz | [Principio]: ISP
export interface IOAuthVerifier {
  readonly provider: 'google' | 'microsoft';
  verify(idToken: string): Promise<VerifiedOAuthProfile>;
}

// [Registry]: mapa provider → verifier para lookup en UseCase | [Patrón]: Registry
export interface IOAuthVerifierRegistry {
  get(provider: string): IOAuthVerifier;
}
