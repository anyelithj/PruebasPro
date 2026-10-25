import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · 2026-10-19]: polyglot_topics.category — agrupa los temas por categoría en la UI (vocabulario, frases, números, gramática, otros) | [Patrón]: Migration (up/down reversible) · `IF NOT EXISTS`: en dev (synchronize=true) la columna ya existe

export class PolyglotTopicCategory1791991700000 implements MigrationInterface {
    name = 'PolyglotTopicCategory1791991700000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "polyglot_topics" ADD COLUMN IF NOT EXISTS "category" character varying(16) NOT NULL DEFAULT 'vocabulary'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "polyglot_topics" DROP COLUMN IF EXISTS "category"`);
    }
}
