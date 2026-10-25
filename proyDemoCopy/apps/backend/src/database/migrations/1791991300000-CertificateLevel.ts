import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · Sprint 7.8]: certificates.cefr_level — banda MCER del curso (A1–C2; null si el curso no es de idiomas) → color del diploma en PDF y UI | [Patrón]: Migration (up/down reversible) + Snapshot (se copia de courses.category al emitir) · `IF NOT EXISTS`: en dev (synchronize=true) la columna ya existe y solo falta el backfill

export class CertificateLevel1791991300000 implements MigrationInterface {
    name = 'CertificateLevel1791991300000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "cefr_level" character varying(2)`);
        // [Backfill]: certificados ya emitidos toman la banda de su curso (`::text`: category es enum de Postgres)
        await queryRunner.query(`UPDATE "certificates" c SET "cefr_level" = k."category"::text FROM "courses" k WHERE k."id" = c."course_id" AND k."category"::text IN ('A1','A2','B1','B2','C1','C2')`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "certificates" DROP COLUMN IF EXISTS "cefr_level"`);
    }
}
