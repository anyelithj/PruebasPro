import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · 2026-11-09 · RF-32]: gestión de certificados — notas de auditoría del ADMIN y solicitud de revocación del DOCENTE

export class CertificateManagement1791993900000 implements MigrationInterface {
    name = 'CertificateManagement1791993900000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "admin_notes" text`);
        await queryRunner.query(`ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "revoke_request_reason" text`);
        await queryRunner.query(`ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "revoke_requested_by" uuid`);
        await queryRunner.query(`ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "revoke_requested_at" timestamptz`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const c of ["revoke_requested_at", "revoke_requested_by", "revoke_request_reason", "admin_notes"])
            await queryRunner.query(`ALTER TABLE "certificates" DROP COLUMN IF EXISTS "${c}"`);
    }
}
