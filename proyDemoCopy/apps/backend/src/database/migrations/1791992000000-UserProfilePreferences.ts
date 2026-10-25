import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · 2026-10-23]: users.bio / timezone / preferred_language — preferencias del perfil pasan de localStorage a BD | [Patrón]: Migration (up/down reversible) · `IF NOT EXISTS`: en dev (synchronize=true) la columna ya puede existir

export class UserProfilePreferences1791992000000 implements MigrationInterface {
    name = 'UserProfilePreferences1791992000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" varchar(300)`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "timezone" varchar(64)`);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferred_language" varchar(5)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "preferred_language"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "timezone"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "bio"`);
    }
}
