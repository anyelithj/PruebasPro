import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · 2026-11-10]: songs.title_ipa/title_translation — glosa del título guardada (sin esperar a la IA al abrir la canción)

export class SongTitleGloss1791994200000 implements MigrationInterface {
    name = 'SongTitleGloss1791994200000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "songs" ADD COLUMN IF NOT EXISTS "title_ipa" varchar(300) NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "songs" ADD COLUMN IF NOT EXISTS "title_translation" varchar(300) NOT NULL DEFAULT ''`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "songs" DROP COLUMN IF EXISTS "title_translation"`);
        await queryRunner.query(`ALTER TABLE "songs" DROP COLUMN IF EXISTS "title_ipa"`);
    }
}
