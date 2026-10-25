import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · Fase 8 · Sprints 8.2/8.5/8.12]: vocabulario y caché de traducción e IPA (vocabulary_entries, language_lookups), juegos (game_sessions, game_rounds, flashcard_states, fluency_metrics, roleplay_scenarios) y práctica (practice_activities, practice_items, practice_attempts) | [Patrón]: Migration (up/down reversible) — generada con TypeORM y filtrada a las tablas de la fase

export class Phase8LanguageGamesPractice1791991400000 implements MigrationInterface {
    name = 'Phase8LanguageGamesPractice1791991400000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "vocabulary_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "language" character varying(2) NOT NULL, "term" character varying(160) NOT NULL, "term_key" character varying(160) NOT NULL, "translation" character varying(300) NOT NULL DEFAULT '', "alternatives" jsonb NOT NULL DEFAULT '[]', "ipa_uk" character varying(300), "ipa_us" character varying(300), "ipa" character varying(300), "example" text, "source_item_id" uuid, "reviewed" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a91a2e8aaca6d9ecb941ee3e653" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e329f640cdcb01e8fc865a455d" ON "vocabulary_entries" ("user_id")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_aaf179e154ccf40b9d7183f624" ON "vocabulary_entries" ("user_id", "language", "term_key")`);
        await queryRunner.query(`CREATE TABLE "language_lookups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fingerprint" character(64) NOT NULL, "kind" character varying(8) NOT NULL, "language" character varying(2) NOT NULL, "text" character varying(500) NOT NULL, "context" text, "result" jsonb NOT NULL, "engine" character varying(60) NOT NULL, "hits" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a054c5a9de421ece2aca668b89c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c5029d01c6ee70feb140c4da0e" ON "language_lookups" ("fingerprint")`);
        await queryRunner.query(`CREATE TABLE "practice_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "activity_id" uuid NOT NULL, "position" integer NOT NULL DEFAULT '0', "item_type" character varying(20) NOT NULL, "skill" character varying(12) NOT NULL, "prompt" text NOT NULL, "options" jsonb NOT NULL DEFAULT '[]', "accepted" jsonb NOT NULL, "corrections" jsonb NOT NULL DEFAULT '{}', "explanation" text NOT NULL DEFAULT '', "tip" text NOT NULL DEFAULT '', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c94defc0a8770e2d82ef8fd8104" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_bb089d813bf1d9b7c3a696f741" ON "practice_items" ("activity_id", "position")`);
        await queryRunner.query(`CREATE TABLE "practice_attempts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "activity_id" uuid NOT NULL, "item_id" uuid NOT NULL, "answer" jsonb NOT NULL, "correct" boolean NOT NULL, "score" real NOT NULL, "feedback" jsonb NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0ae13205d3b8c8b125fdd284cb0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_81a4c473a5a80e7f2e6be12fa3" ON "practice_attempts" ("user_id", "created_at")`);
        await queryRunner.query(`CREATE TABLE "practice_activities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(160) NOT NULL, "description" text NOT NULL DEFAULT '', "language" character varying(2) NOT NULL, "level" character varying(2) NOT NULL, "skill" character varying(12) NOT NULL, "status" character varying(10) NOT NULL DEFAULT 'draft', "ai_draft" boolean NOT NULL DEFAULT false, "created_by" uuid NOT NULL, "archived_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4c1cced9881dc3e9d7b89cf0cf3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_70709d21d7b6773c5032d57101" ON "practice_activities" ("language", "level", "skill")`);
        await queryRunner.query(`CREATE TABLE "roleplay_scenarios" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "slug" character varying(80) NOT NULL, "title" character varying(120) NOT NULL, "language" character varying(2) NOT NULL, "level" character varying(2) NOT NULL, "emoji" character varying(16) NOT NULL DEFAULT '💬', "role" character varying(120) NOT NULL, "opening" text NOT NULL DEFAULT '', "objectives" jsonb NOT NULL, "vocabulary" jsonb NOT NULL DEFAULT '[]', "created_by" uuid, "archived_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_eacbc5a193cede0fd12a3d0a680" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_847b81191fc696222981e27549" ON "roleplay_scenarios" ("slug")`);
        await queryRunner.query(`CREATE INDEX "IDX_a76b4e137a1cbb6c5700180fd9" ON "roleplay_scenarios" ("language", "level")`);
        await queryRunner.query(`CREATE TABLE "game_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "game_type" character varying(32) NOT NULL, "language" character varying(2) NOT NULL, "level" character varying(2), "difficulty" smallint NOT NULL DEFAULT '1', "scenario_id" uuid, "content" jsonb NOT NULL, "status" character varying(12) NOT NULL DEFAULT 'active', "score" integer NOT NULL DEFAULT '0', "rounds_count" integer NOT NULL DEFAULT '0', "correct_count" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "finished_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_e25fa82d55744e55000c3288fdc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fa6ab19a40b8586446a612a878" ON "game_sessions" ("user_id", "created_at")`);
        await queryRunner.query(`CREATE TABLE "game_rounds" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "session_id" uuid NOT NULL, "user_id" uuid NOT NULL, "index" integer NOT NULL, "prompt" text NOT NULL DEFAULT '', "answer" text NOT NULL DEFAULT '', "correct" boolean, "time_to_answer_ms" integer, "duration_ms" integer, "words_produced" integer NOT NULL DEFAULT '0', "evaluation" jsonb NOT NULL DEFAULT '{}', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9f9de91990bb512595f1058b98c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_879e5859d620c3d025b676720c" ON "game_rounds" ("session_id", "index")`);
        await queryRunner.query(`CREATE TABLE "fluency_metrics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "session_id" uuid NOT NULL, "round_id" uuid, "time_to_respond_s" real NOT NULL, "speaking_time_s" real NOT NULL, "pauses" integer NOT NULL, "longest_run_s" real NOT NULL, "words_produced" integer NOT NULL, "words_per_minute" real NOT NULL, "reuse_ratio" real NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0dc9ddd248376aec4be90a16276" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8da65020bb8a4303c186b64908" ON "fluency_metrics" ("user_id", "created_at")`);
        await queryRunner.query(`CREATE TABLE "flashcard_states" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "entry_id" uuid NOT NULL, "repetitions" integer NOT NULL DEFAULT '0', "interval_days" integer NOT NULL DEFAULT '0', "ease" real NOT NULL DEFAULT '2.5', "due_at" TIMESTAMP WITH TIME ZONE NOT NULL, "last_quality" smallint, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_abeb50d000eccced1730655df38" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ae4b41f78bc2dd016d8b42b800" ON "flashcard_states" ("user_id", "due_at")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_cdc256c21ebbc0a67189fe68b3" ON "flashcard_states" ("user_id", "entry_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "flashcard_states"`);
        await queryRunner.query(`DROP TABLE "fluency_metrics"`);
        await queryRunner.query(`DROP TABLE "game_rounds"`);
        await queryRunner.query(`DROP TABLE "game_sessions"`);
        await queryRunner.query(`DROP TABLE "roleplay_scenarios"`);
        await queryRunner.query(`DROP TABLE "practice_activities"`);
        await queryRunner.query(`DROP TABLE "practice_attempts"`);
        await queryRunner.query(`DROP TABLE "practice_items"`);
        await queryRunner.query(`DROP TABLE "language_lookups"`);
        await queryRunner.query(`DROP TABLE "vocabulary_entries"`);
    }
}
