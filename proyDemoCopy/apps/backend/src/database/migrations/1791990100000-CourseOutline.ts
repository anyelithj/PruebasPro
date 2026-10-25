import { MigrationInterface, QueryRunner } from 'typeorm';

export class CourseOutline1791990100000 implements MigrationInterface {
  name = 'CourseOutline1791990100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."course_nodes_type_enum" AS ENUM('level', 'module', 'unit', 'lesson')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."course_nodes_level_enum" AS ENUM('A1', 'A2', 'B1', 'B2', 'C1', 'C2')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."course_nodes_kind_enum" AS ENUM('grammar_rule', 'vocabulary', 'example', 'translation', 'pronunciation', 'common_error', 'exercise', 'rubric')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."course_nodes_skill_enum" AS ENUM('grammar', 'vocabulary', 'reading', 'listening', 'writing', 'speaking', 'pronunciation')`,
    );
    await queryRunner.query(
      `CREATE TABLE "course_nodes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "course_id" uuid NOT NULL, "parent_id" uuid, "type" "public"."course_nodes_type_enum" NOT NULL, "title" character varying(160) NOT NULL, "position" smallint NOT NULL DEFAULT '0', "level" "public"."course_nodes_level_enum" NOT NULL, "topic" character varying(160), "kind" "public"."course_nodes_kind_enum", "skill" "public"."course_nodes_skill_enum", "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a92f4c09300ee47af733ab29054" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_course_node_tree" ON "course_nodes" ("course_id", "parent_id", "position") `,
    );
    await queryRunner.query(
      `CREATE TABLE "course_lesson_items" ("lesson_id" uuid NOT NULL, "item_id" uuid NOT NULL, CONSTRAINT "PK_9fbf0b1a5062ad710335cc88a43" PRIMARY KEY ("lesson_id", "item_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7ef33a6e71274f3e8fc989ab28" ON "course_lesson_items" ("lesson_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cf9d5afbfd68b26bbf1dc36b76" ON "course_lesson_items" ("item_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "course_nodes" ADD CONSTRAINT "FK_1f3275d1f87a04fd8ccd280196a" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_nodes" ADD CONSTRAINT "FK_d3e48997e91eebc146e02253d90" FOREIGN KEY ("parent_id") REFERENCES "course_nodes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_lesson_items" ADD CONSTRAINT "FK_7ef33a6e71274f3e8fc989ab28c" FOREIGN KEY ("lesson_id") REFERENCES "course_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_lesson_items" ADD CONSTRAINT "FK_cf9d5afbfd68b26bbf1dc36b761" FOREIGN KEY ("item_id") REFERENCES "curriculum_items"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_lesson_items" DROP CONSTRAINT "FK_cf9d5afbfd68b26bbf1dc36b761"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_lesson_items" DROP CONSTRAINT "FK_7ef33a6e71274f3e8fc989ab28c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_nodes" DROP CONSTRAINT "FK_d3e48997e91eebc146e02253d90"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_nodes" DROP CONSTRAINT "FK_1f3275d1f87a04fd8ccd280196a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cf9d5afbfd68b26bbf1dc36b76"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7ef33a6e71274f3e8fc989ab28"`,
    );
    await queryRunner.query(`DROP TABLE "course_lesson_items"`);
    await queryRunner.query(`DROP INDEX "public"."ix_course_node_tree"`);
    await queryRunner.query(`DROP TABLE "course_nodes"`);
    await queryRunner.query(`DROP TYPE "public"."course_nodes_skill_enum"`);
    await queryRunner.query(`DROP TYPE "public"."course_nodes_kind_enum"`);
    await queryRunner.query(`DROP TYPE "public"."course_nodes_level_enum"`);
    await queryRunner.query(`DROP TYPE "public"."course_nodes_type_enum"`);
  }
}
