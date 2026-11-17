import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · 2026-10-27]: courses.created_by — dueño del curso (el docente gestiona solo los suyos; el admin, todos) | [Patrón]: Migration (up/down reversible)
// `IF NOT EXISTS` / `IF EXISTS`: idempotente (en dev con synchronize=true la columna ya puede existir) | NULL en los cursos antiguos → solo los gestiona el ADMIN

export class CourseOwner1791992900000 implements MigrationInterface {
    name = 'CourseOwner1791992900000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "created_by" uuid`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_courses_created_by" ON "courses" ("created_by")`); // «Mis cursos» del docente sin recorrer la tabla
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_courses_created_by"`);
        await queryRunner.query(`ALTER TABLE "courses" DROP COLUMN IF EXISTS "created_by"`);
    }
}
