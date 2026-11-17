import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · 2026-11-03]: `embed_url` = reproductor oficial (YouTube, Spotify…) de una canción cuyo enlace pegó el docente · el audio no se descarga

export class SongEmbedUrl1791993710000 implements MigrationInterface {
    name = 'SongEmbedUrl1791993710000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "songs" ADD COLUMN IF NOT EXISTS "embed_url" varchar(400)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "songs" DROP COLUMN IF EXISTS "embed_url"`);
    }
}
