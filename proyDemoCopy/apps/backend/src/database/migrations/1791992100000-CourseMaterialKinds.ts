import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · 2026-10-23]: course_materials admite audio, documentos y enlaces (columna url) | [Patrón]: Migration · `ADD VALUE IF NOT EXISTS` (PostgreSQL 12+): idempotente
// [down]: PostgreSQL no permite quitar valores de un enum → solo se borra la columna url

export class CourseMaterialKinds1791992100000 implements MigrationInterface {
    name = 'CourseMaterialKinds1791992100000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const v of ['audio', 'document', 'link'])
            await queryRunner.query(`ALTER TYPE "public"."course_materials_kind_enum" ADD VALUE IF NOT EXISTS '${v}'`);
        await queryRunner.query(`ALTER TABLE "course_materials" ADD COLUMN IF NOT EXISTS "url" varchar(2000)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "course_materials" DROP COLUMN IF EXISTS "url"`);
    }
}
