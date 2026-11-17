import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · 2026-11-06 · Exámenes]: quizzes.kind (practice | final | level) + curso, nivel, nota mínima, tiempo total y preguntas por intento · quiz_sessions con preguntas sorteadas, % y aprobado
// certificates: course_id opcional (certificado de NIVEL), examen que lo otorgó y su nota · `IF NOT EXISTS`: en dev (synchronize=true) las columnas ya existen

export class CourseExams1791993800000 implements MigrationInterface {
    name = 'CourseExams1791993800000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "kind" varchar(16) NOT NULL DEFAULT 'practice'`);
        await queryRunner.query(`ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "course_id" uuid`);
        await queryRunner.query(`ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "cefr_level" varchar(2)`);
        await queryRunner.query(`ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "pass_score" smallint NOT NULL DEFAULT 70`);
        await queryRunner.query(`ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "time_limit_minutes" smallint NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "questions_per_attempt" smallint NOT NULL DEFAULT 0`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_quizzes_kind" ON "quizzes" ("kind")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_quizzes_course_id" ON "quizzes" ("course_id")`);
        await queryRunner.query(`ALTER TABLE "quiz_sessions" ADD COLUMN IF NOT EXISTS "question_ids" jsonb`);
        await queryRunner.query(`ALTER TABLE "quiz_sessions" ADD COLUMN IF NOT EXISTS "percent" smallint`);
        await queryRunner.query(`ALTER TABLE "quiz_sessions" ADD COLUMN IF NOT EXISTS "passed" boolean`);
        await queryRunner.query(`ALTER TABLE "certificates" ALTER COLUMN "course_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "quiz_id" uuid`);
        await queryRunner.query(`ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "exam_score" smallint`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_certificates_user_level" ON "certificates" ("user_id", "quiz_id") WHERE "course_id" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_certificates_user_level"`);
        await queryRunner.query(`DELETE FROM "certificates" WHERE "course_id" IS NULL`);
        await queryRunner.query(`ALTER TABLE "certificates" DROP COLUMN IF EXISTS "exam_score"`);
        await queryRunner.query(`ALTER TABLE "certificates" DROP COLUMN IF EXISTS "quiz_id"`);
        await queryRunner.query(`ALTER TABLE "certificates" ALTER COLUMN "course_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "quiz_sessions" DROP COLUMN IF EXISTS "passed"`);
        await queryRunner.query(`ALTER TABLE "quiz_sessions" DROP COLUMN IF EXISTS "percent"`);
        await queryRunner.query(`ALTER TABLE "quiz_sessions" DROP COLUMN IF EXISTS "question_ids"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quizzes_course_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quizzes_kind"`);
        for (const c of ['questions_per_attempt', 'time_limit_minutes', 'pass_score', 'cefr_level', 'course_id', 'kind'])
            await queryRunner.query(`ALTER TABLE "quizzes" DROP COLUMN IF EXISTS "${c}"`);
    }
}
