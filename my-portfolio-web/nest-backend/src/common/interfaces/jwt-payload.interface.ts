// [ISP][CC-N] contrato mínimo del token
export interface JwtPayload {
  sub: string;
  role: string;
  type: string;
  jti?: string;
  iat?: number;
  exp?: number;
}
