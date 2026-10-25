import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
// [UseCase PurgeExpiredSessions · Sprint 7.18 · RF-81]: purga nocturna de sesiones y tokens de un solo uso vencidos + correos ya enviados antiguos | [Patrón]: Use Case (Command) + Batch Job | [Principio]: SRP + minimización de datos (no se guardan secretos caducados) | [Paradigma]: Declarativo (SQL)
// [Por qué SQL directo]: las tablas son de Auth y Notifications; registrar sus entidades aquí duplicaría dueños · un DELETE por tabla es atómico e idempotente

// [Retención]: margen de 1 día tras caducar (soporte/diagnóstico) · correos enviados: 30 días
export const PURGE_RULES = [
  {
    table: 'auth_sessions',
    where: `(expires_at < now() - interval '1 day') OR (is_revoked AND created_at < now() - interval '30 days')`,
  },
  {
    table: 'password_reset_tokens',
    where: `expires_at < now() - interval '1 day'`,
  },
  {
    table: 'email_verification_tokens',
    where: `expires_at < now() - interval '1 day'`,
  },
  {
    table: 'magic_link_tokens',
    where: `expires_at < now() - interval '1 day'`,
  },
  {
    table: 'email_outbox',
    where: `status = 'sent' AND sent_at < now() - interval '30 days'`,
  },
] as const;

@Injectable()
export class PurgeExpiredSessionsUseCase {
  private readonly logger = new Logger(PurgeExpiredSessionsUseCase.name);

  constructor(private readonly ds: DataSource) {}

  async execute(): Promise<Record<string, number>> {
    const deleted: Record<string, number> = {};
    for (const { table, where } of PURGE_RULES) {
      // `query` (TypeORM): devuelve [filas, contador] en PostgreSQL para DELETE · reglas constantes (sin datos del usuario → sin inyección)
      const [, count] = await this.ds.query<[unknown, number]>(
        `DELETE FROM "${table}" WHERE ${where}`,
      );
      deleted[table] = count ?? 0;
    }
    this.logger.log(`Purga nocturna: ${JSON.stringify(deleted)}`);
    return deleted;
  }
}
