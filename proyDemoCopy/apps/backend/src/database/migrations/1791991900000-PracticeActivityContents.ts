import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · 2026-10-23]: practice_activities.contents — contenidos vinculados de otras secciones (vocabulario, juego, canción, diálogo…) | [Patrón]: Migration (up/down reversible) · `IF NOT EXISTS`: en dev (synchronize=true) la columna ya puede existir

export class PracticeActivityContents1791991900000 implements MigrationInterface {
    name = 'PracticeActivityContents1791991900000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "practice_activities" ADD COLUMN IF NOT EXISTS "contents" jsonb NOT NULL DEFAULT '[]'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "practice_activities" DROP COLUMN IF EXISTS "contents"`);
    }
}
