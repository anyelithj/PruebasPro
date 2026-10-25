import { MigrationInterface, QueryRunner } from "typeorm";

export class LessonProgress1791990400000 implements MigrationInterface {
    name = 'LessonProgress1791990400000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "lesson_progress" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "lesson_id" uuid NOT NULL, "completed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_lesson_progress_user_lesson" UNIQUE ("user_id", "lesson_id"), CONSTRAINT "PK_e6223ebbc5f8f5fce40e0193de1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "ix_lesson_progress_user" ON "lesson_progress" ("user_id") `);
        await queryRunner.query(`ALTER TABLE "lesson_progress" ADD CONSTRAINT "FK_980e74721039ebe210fee2eeca2" FOREIGN KEY ("lesson_id") REFERENCES "course_nodes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lesson_progress" DROP CONSTRAINT "FK_980e74721039ebe210fee2eeca2"`);
        await queryRunner.query(`DROP INDEX "public"."ix_lesson_progress_user"`);
        await queryRunner.query(`DROP TABLE "lesson_progress"`);
    }

}
