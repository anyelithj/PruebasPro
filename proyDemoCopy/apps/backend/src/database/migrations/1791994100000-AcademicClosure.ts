import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · 2026-11-09 · RF-32]: cierre académico del docente (requisito del certificado de curso) + nota final corregida por el docente
// Los alumnos que YA tienen certificado quedan con el cierre aprobado (no se les quita nada)

export class AcademicClosure1791994100000 implements MigrationInterface {
    name = 'AcademicClosure1791994100000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "course_enrollments" ADD COLUMN IF NOT EXISTS "closure_approved_at" timestamptz`);
        await queryRunner.query(`ALTER TABLE "course_enrollments" ADD COLUMN IF NOT EXISTS "closure_approved_by" uuid`);
        await queryRunner.query(`ALTER TABLE "course_enrollments" ADD COLUMN IF NOT EXISTS "final_grade" smallint CHECK ("final_grade" BETWEEN 0 AND 100)`);
        await queryRunner.query(`ALTER TABLE "course_enrollments" ADD COLUMN IF NOT EXISTS "grade_note" text`);
        await queryRunner.query(`ALTER TABLE "course_enrollments" ADD COLUMN IF NOT EXISTS "grade_by" uuid`);
        await queryRunner.query(`UPDATE "course_enrollments" e SET "closure_approved_at" = c."issued_at"
            FROM "certificates" c WHERE c."user_id" = e."user_id" AND c."course_id" = e."course_id" AND e."closure_approved_at" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const c of ["grade_by", "grade_note", "final_grade", "closure_approved_by", "closure_approved_at"])
            await queryRunner.query(`ALTER TABLE "course_enrollments" DROP COLUMN IF EXISTS "${c}"`);
    }
}
