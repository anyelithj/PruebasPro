import { Session } from '../entities/session.entity';
// [Port repositorio Auth/Session]: contrato Domain → Infrastructure | [Patrón]: Repository + Port (Hexagonal) | [Principio]: DIP + ISP | [Paradigma]: POO

// [Token DI]: provider key para inyectar la implementación sin acoplar a TypeORM
export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');

// [Input nueva sesión]: data necesaria al emitir un refresh token
export interface CreateSessionInput {
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

// [Contrato del repo]: métodos mínimos requeridos por los UseCases | [Principio]: ISP
export interface ISessionRepository {
  // [createSession]: persiste un refresh token nuevo
  createSession(input: CreateSessionInput): Promise<Session>;
  // [findActiveSession]: lookup por hash (login/refresh comparan hash, no claro)
  findActiveByHash(refreshTokenHash: string): Promise<Session | null>;
  // [revoke]: marca una sesión como invalidada (logout o rotación)
  revoke(sessionId: string): Promise<void>;
  // [revokeAllForUser]: usado en cambio de password o logout-all
  revokeAllForUser(userId: string): Promise<void>;
}
