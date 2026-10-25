import { Role } from '../../../users/domain/value-objects/role.vo';
import { TokenPair } from '../value-objects/token-pair.vo';
// [Port servicio de tokens]: contrato emisión/verificación JWT | [Patrón]: Port (Hexagonal) | [Principio]: DIP + ISP | [Paradigma]: POO

// [Token DI]: provider key para inyectar la implementación concreta (JwtTokenService)
export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');

// [Claims emitidos]: forma de la información codificada en JWT
export interface IssueTokenInput {
  userId: string;
  email: string;
  role: Role;
}

// [Contrato servicio]: emisión + verificación | [Principio]: ISP
export interface ITokenService {
  // [issuePair]: emite par access+refresh tras login/refresh
  issuePair(input: IssueTokenInput): Promise<TokenPair>;
  // [verifyRefresh]: valida un refresh-token y devuelve sus claims
  verifyRefresh(token: string): Promise<IssueTokenInput & { exp: number }>;
  // [hashRefresh]: hash determinístico del refresh token para guardar en DB
  hashRefresh(token: string): string;
}
