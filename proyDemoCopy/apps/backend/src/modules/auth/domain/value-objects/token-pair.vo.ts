// [Token Pair]: VO inmutable que representa un par de tokens emitidos | [Patrón]: Value Object | [Principio]: SRP | [Paradigma]: POO + Inmutabilidad

// [Tipos de tokens]: enum estricto para evitar magic strings en flujos | [Patrón]: Enum (algebraico)
export enum TokenType {
  ACCESS = 'ACCESS',
  REFRESH = 'REFRESH',
}

// [Pair inmutable]: tipo de retorno común para login/refresh/register
export interface TokenPair {
  // [Access token JWT]: corta vida, enviado en Authorization: Bearer
  accessToken: string;
  // [Refresh token JWT]: larga vida, usado solo para rotar
  refreshToken: string;
  // [Expiración access en segundos]: front lo usa para programar el refresh
  accessExpiresIn: number;
  // [Tipo Bearer]: estándar OAuth 2.0
  tokenType: 'Bearer';
}
