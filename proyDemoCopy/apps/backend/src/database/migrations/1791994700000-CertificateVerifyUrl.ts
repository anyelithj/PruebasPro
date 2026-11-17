import { MigrationInterface, QueryRunner } from 'typeorm'; // [TypeORM]: contrato de migración (up / down)
// [Migración · 2026-11-13 · Caso E]: certificates.verify_url — URL pública que codifica el QR, fijada al emitir (no cambia aunque cambie el dominio)
// Los certificados ya emitidos quedan en null: su PDF lleva /verificar/<código>, que redirige a /certificados/verificar/<código> | [Idempotente]

export class CertificateVerifyUrl1791994700000 implements MigrationInterface {
  name = 'CertificateVerifyUrl1791994700000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "verify_url" varchar(300)`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "certificates" DROP COLUMN IF EXISTS "verify_url"`,
    );
  }
}
