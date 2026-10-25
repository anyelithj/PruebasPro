import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · Sprint 7.14]: foros por lección — forum_threads y forum_posts (borrado lógico con deleted_at) | [Patrón]: Migration (up/down reversible)

export class Forums1791991000000 implements MigrationInterface {
    name = 'Forums1791991000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "forum_threads" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "lesson_id" uuid NOT NULL, "course_id" uuid NOT NULL, "author_id" uuid NOT NULL, "author_name" character varying(160) NOT NULL, "title" character varying(160) NOT NULL, "body" text NOT NULL, "status" character varying(8) NOT NULL DEFAULT 'open', "pinned" boolean NOT NULL DEFAULT false, "posts_count" integer NOT NULL DEFAULT 0, "last_post_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_forum_threads" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_forum_threads_lesson" ON "forum_threads" ("lesson_id", "pinned", "last_post_at")`);
        await queryRunner.query(`CREATE TABLE "forum_posts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "thread_id" uuid NOT NULL, "author_id" uuid NOT NULL, "author_name" character varying(160) NOT NULL, "body" text NOT NULL, "edited_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_forum_posts" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_forum_posts_thread" ON "forum_posts" ("thread_id", "created_at")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "forum_posts"`);
        await queryRunner.query(`DROP TABLE "forum_threads"`);
    }
}
