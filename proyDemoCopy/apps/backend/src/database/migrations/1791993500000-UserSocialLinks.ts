import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · 2026-10-28]: users.linkedin_url / twitter_url / spotify_url / youtube_url — redes sociales del docente para «Autoría del contenido» del curso | [Patrón]: Migration (up/down reversible)
// `IF NOT EXISTS` / `IF EXISTS`: idempotente (en dev con synchronize=true las columnas ya pueden existir) | NULL = red no configurada → la UI la oculta

export class UserSocialLinks1791993500000 implements MigrationInterface {
    name = 'UserSocialLinks1791993500000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "linkedin_url" varchar(255)`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "twitter_url" varchar(255)`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "spotify_url" varchar(255)`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "youtube_url" varchar(255)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "youtube_url"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "spotify_url"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "twitter_url"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "linkedin_url"`);
    }
}
