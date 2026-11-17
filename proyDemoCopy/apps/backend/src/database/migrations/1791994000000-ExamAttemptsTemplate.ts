import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · 2026-11-09 · RF-32]: Gestión → Certificados — anular intentos de examen (incidencia técnica, con motivo auditable) y plantilla del PDF (fila única)

export class ExamAttemptsTemplate1791994000000 implements MigrationInterface {
    name = 'ExamAttemptsTemplate1791994000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "quiz_sessions" ADD COLUMN IF NOT EXISTS "voided_at" timestamptz`);
        await queryRunner.query(`ALTER TABLE "quiz_sessions" ADD COLUMN IF NOT EXISTS "void_reason" text`);
        await queryRunner.query(`ALTER TABLE "quiz_sessions" ADD COLUMN IF NOT EXISTS "voided_by" uuid`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "certificate_template" (
            "id" smallint PRIMARY KEY DEFAULT 1 CHECK ("id" = 1),
            "institution" text NOT NULL DEFAULT 'AULA DE IDIOMAS',
            "signer_name" text,
            "signer_title" text,
            "legal_text" text,
            "updated_at" timestamptz NOT NULL DEFAULT now())`);
        await queryRunner.query(`INSERT INTO "certificate_template" ("id") VALUES (1) ON CONFLICT DO NOTHING`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "certificate_template"`);
        for (const c of ["voided_by", "void_reason", "voided_at"])
            await queryRunner.query(`ALTER TABLE "quiz_sessions" DROP COLUMN IF EXISTS "${c}"`);
    }
}
