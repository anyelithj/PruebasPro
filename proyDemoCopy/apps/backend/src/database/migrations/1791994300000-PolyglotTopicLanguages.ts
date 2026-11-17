import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · 2026-11-11]: polyglot_topics.languages — idiomas que compara el tema (vacío = los siete)
// + polyglot_concepts.image_url varchar(400) → text: admite imagen adjunta (data URL WebP, como Recursos) además de enlace https

export class PolyglotTopicLanguages1791994300000 implements MigrationInterface {
    name = 'PolyglotTopicLanguages1791994300000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "polyglot_topics" ADD COLUMN IF NOT EXISTS "languages" jsonb NOT NULL DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "polyglot_concepts" ALTER COLUMN "image_url" TYPE text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE "polyglot_concepts" SET "image_url" = NULL WHERE length("image_url") > 400`);
        await queryRunner.query(`ALTER TABLE "polyglot_concepts" ALTER COLUMN "image_url" TYPE varchar(400)`);
        await queryRunner.query(`ALTER TABLE "polyglot_topics" DROP COLUMN IF EXISTS "languages"`);
    }
}
