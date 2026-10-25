import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · Sprint 7.10]: Centro de ayuda — faqs, manual_articles y guide_feedback | [Patrón]: Migration (up/down reversible)
// [Integridad]: un artículo por slug e idioma · una valoración por usuario, conversación y mensaje

export class Help1791990900000 implements MigrationInterface {
    name = 'Help1791990900000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "faqs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "question" character varying(300) NOT NULL, "answer" text NOT NULL, "category" character varying(40) NOT NULL, "role" character varying(8) NOT NULL DEFAULT 'ALL', "locale" character varying(2) NOT NULL DEFAULT 'es', "manual_slug" character varying(80), "status" character varying(12) NOT NULL DEFAULT 'published', "reviewed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_faqs" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_faqs_locale_status_category" ON "faqs" ("locale", "status", "category")`);
        await queryRunner.query(`CREATE TABLE "manual_articles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "slug" character varying(80) NOT NULL, "locale" character varying(2) NOT NULL, "role" character varying(8) NOT NULL, "title" character varying(160) NOT NULL, "body" text NOT NULL, "sha256" character(64) NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_manual_articles" PRIMARY KEY ("id"), CONSTRAINT "UQ_manual_articles_slug_locale" UNIQUE ("slug", "locale"))`);
        await queryRunner.query(`CREATE TABLE "guide_feedback" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "session_id" uuid NOT NULL, "message_index" integer NOT NULL, "question" text NOT NULL, "answer" text NOT NULL, "answered_by" character varying(8) NOT NULL, "helpful" boolean NOT NULL, "route" character varying(200), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_guide_feedback" PRIMARY KEY ("id"), CONSTRAINT "UQ_guide_feedback_message" UNIQUE ("user_id", "session_id", "message_index"))`);
        await queryRunner.query(`CREATE INDEX "IDX_guide_feedback_helpful" ON "guide_feedback" ("helpful", "created_at")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "guide_feedback"`);
        await queryRunner.query(`DROP TABLE "manual_articles"`);
        await queryRunner.query(`DROP TABLE "faqs"`);
    }
}
