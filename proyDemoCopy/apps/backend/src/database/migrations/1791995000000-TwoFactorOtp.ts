import { MigrationInterface, QueryRunner } from 'typeorm'; // [TypeORM]: contrato de migración (up / down)
// [Migración · 2026-11-16 · 2FA]: users.two_factor_enabled + tabla login_otps (código de un solo uso enviado por correo)
// [Idempotente]: IF NOT EXISTS → no falla si DATABASE_SYNCHRONIZE=true ya creó las columnas en desarrollo

export class TwoFactorOtp1791995000000 implements MigrationInterface {
  name = 'TwoFactorOtp1791995000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_enabled" boolean NOT NULL DEFAULT false`,
    );
    await q.query(`CREATE TABLE IF NOT EXISTS "login_otps" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "user_id" uuid NOT NULL,
      "code_hash" char(64) NOT NULL,
      "attempts" smallint NOT NULL DEFAULT 0,
      "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
      "used_at" TIMESTAMP WITH TIME ZONE,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_login_otps" PRIMARY KEY ("id"))`);
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_login_otps_user" ON "login_otps" ("user_id")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "login_otps"`);
    await q.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "two_factor_enabled"`,
    );
  }
}
