import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · 2026-10-24]: contenido del curso en Markdown, separado de la descripción (resumen) | `text` (PostgreSQL): sin límite de longitud práctico (hasta 1 GB)
// [Patrón]: Migration (DDL versionado) | `IF NOT EXISTS` / `IF EXISTS`: idempotente (no falla si ya se aplicó con synchronize en desarrollo)

export class CourseContent1791992450000 implements MigrationInterface {
    name = 'CourseContent1791992450000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "content" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "courses" DROP COLUMN IF EXISTS "content"`);
    }
}
