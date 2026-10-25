import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · 2026-10-24]: número de teléfono opcional del usuario (Mi perfil y Gestión → Crear usuario) | `IF NOT EXISTS`: idempotente

export class UserPhone1791992300000 implements MigrationInterface {
    name = 'UserPhone1791992300000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" varchar(30)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "phone"`);
    }
}
