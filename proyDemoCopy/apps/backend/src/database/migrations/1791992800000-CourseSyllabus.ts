import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · 2026-10-25]: ficha del curso separada del temario (objetivos y público) + subtemas estudiados por el alumno (progreso) | `IF NOT EXISTS`: idempotente

export class CourseSyllabus1791992800000 implements MigrationInterface {
    name = 'CourseSyllabus1791992800000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "objectives" text`);
        await queryRunner.query(`ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "audience" text`);
        await queryRunner.query(`ALTER TABLE "course_enrollments" ADD COLUMN IF NOT EXISTS "completed_topics" text[] NOT NULL DEFAULT '{}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "course_enrollments" DROP COLUMN IF EXISTS "completed_topics"`);
        await queryRunner.query(`ALTER TABLE "courses" DROP COLUMN IF EXISTS "audience"`);
        await queryRunner.query(`ALTER TABLE "courses" DROP COLUMN IF EXISTS "objectives"`);
    }
}
