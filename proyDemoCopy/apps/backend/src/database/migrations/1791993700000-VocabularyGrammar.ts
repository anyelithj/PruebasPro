import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · 2026-11-03 · Regla obligatoria de vocabulario]: `grammar` (jsonb) = artículo, género, plural, clasificador… de cada sustantivo | null = pendiente (se completa sola)

export class VocabularyGrammar1791993700000 implements MigrationInterface {
    name = 'VocabularyGrammar1791993700000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vocabulary_entries" ADD COLUMN IF NOT EXISTS "grammar" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vocabulary_entries" DROP COLUMN IF EXISTS "grammar"`);
    }
}
