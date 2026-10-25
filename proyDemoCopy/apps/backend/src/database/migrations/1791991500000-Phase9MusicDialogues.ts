import { MigrationInterface, QueryRunner } from 'typeorm';
// [Migración · Fase 9 · Sprints 9.2/9.3]: música (songs, song_lines, song_collections) y diálogos (dialogue_topics, dialogues, dialogue_turns, dialogue_sessions) | [Patrón]: Migration (up/down reversible) — generada con TypeORM y filtrada a las tablas de la fase

export class Phase9MusicDialogues1791991500000 implements MigrationInterface {
  name = 'Phase9MusicDialogues1791991500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "songs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(160) NOT NULL, "artist" character varying(160) NOT NULL DEFAULT '', "language" character varying(2) NOT NULL, "level" character varying(2) NOT NULL, "status" character varying(10) NOT NULL DEFAULT 'draft', "license" jsonb NOT NULL, "review_note" text NOT NULL DEFAULT '', "audio_key" character varying(200), "audio_mime" character varying(40), "audio_size" integer, "practice_ids" jsonb NOT NULL DEFAULT '{}', "created_by" uuid NOT NULL, "withdrawn_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e504ce8ad2e291d3a1d8f1ea2f4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3176758d8e1d4a30f5de3d7e21" ON "songs" ("language", "level", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "song_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "song_id" uuid NOT NULL, "position" integer NOT NULL, "text" text NOT NULL, "ipa" text NOT NULL DEFAULT '', "ipa_us" text, "translation" text, "start_s" real, "end_s" real, "timing_source" character varying(6), "reviewed" boolean NOT NULL DEFAULT false, "needs_native_review" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_af660b6d8f3354f3ca76ecc3cfd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9732c95a9059b9e8563ca640d3" ON "song_lines" ("song_id", "position") `,
    );
    await queryRunner.query(
      `CREATE TABLE "song_collections" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(120) NOT NULL, "description" text NOT NULL DEFAULT '', "language" character varying(2) NOT NULL, "level" character varying(2), "theme" character varying(60), "emoji" character varying(16) NOT NULL DEFAULT '🎵', "song_ids" jsonb NOT NULL DEFAULT '[]', "created_by" uuid NOT NULL, "archived_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b1d262b85bca2f3a98833656d01" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e1865ccc6a73dcd3a214c68efa" ON "song_collections" ("language", "level") `,
    );
    await queryRunner.query(
      `CREATE TABLE "dialogues" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(160) NOT NULL, "topic_id" uuid, "language" character varying(2) NOT NULL, "speakers" jsonb NOT NULL DEFAULT '["A","B"]', "level" character varying(2), "level_status" character varying(10) NOT NULL DEFAULT 'estimated', "level_estimate" jsonb, "license" jsonb NOT NULL, "audio_key" character varying(200), "audio_mime" character varying(40), "created_by" uuid NOT NULL, "withdrawn_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6746abe5bef7ba5c9f006569462" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_eecde8833091e0809957857d0b" ON "dialogues" ("language", "level", "level_status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "dialogue_topics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "slug" character varying(60) NOT NULL, "title" character varying(120) NOT NULL, "emoji" character varying(16) NOT NULL DEFAULT '💬', "description" text NOT NULL DEFAULT '', "language" character varying(2), "levels" jsonb NOT NULL DEFAULT '[]', "objectives" jsonb NOT NULL DEFAULT '[]', "vocabulary" jsonb NOT NULL DEFAULT '{}', "opening" text, "created_by" uuid, "archived_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_437182e74dbbbc01ba5b7607fce" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_212e6e4c72b2d81ef297eec646" ON "dialogue_topics" ("slug") `,
    );
    await queryRunner.query(
      `CREATE TABLE "dialogue_turns" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "dialogue_id" uuid, "session_id" uuid, "position" integer NOT NULL, "speaker" character varying(6) NOT NULL, "text" text NOT NULL, "ipa" text NOT NULL DEFAULT '', "ipa_us" text, "translation" text, "start_s" real, "end_s" real, "correction" text, "reviewed" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_8dd50512858f144a3c1c6760ef2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_72fdf6007229d79ea4d24aa23d" ON "dialogue_turns" ("session_id", "position") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_68d3fd96717b75184b6b50b5b4" ON "dialogue_turns" ("dialogue_id", "position") `,
    );
    await queryRunner.query(
      `CREATE TABLE "dialogue_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "topic_id" uuid NOT NULL, "language" character varying(2) NOT NULL, "level" character varying(2) NOT NULL, "status" character varying(8) NOT NULL DEFAULT 'active', "conversation_id" character varying(64), "user_turns" integer NOT NULL DEFAULT '0', "vocabulary_used" jsonb NOT NULL DEFAULT '[]', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ended_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_b26767e559544eca6e27f0bc5e6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a72cc2d771c73e5936f3c3358c" ON "dialogue_sessions" ("user_id", "created_at") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a72cc2d771c73e5936f3c3358c"`,
    );
    await queryRunner.query(`DROP TABLE "dialogue_sessions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_68d3fd96717b75184b6b50b5b4"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_72fdf6007229d79ea4d24aa23d"`,
    );
    await queryRunner.query(`DROP TABLE "dialogue_turns"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_212e6e4c72b2d81ef297eec646"`,
    );
    await queryRunner.query(`DROP TABLE "dialogue_topics"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_eecde8833091e0809957857d0b"`,
    );
    await queryRunner.query(`DROP TABLE "dialogues"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e1865ccc6a73dcd3a214c68efa"`,
    );
    await queryRunner.query(`DROP TABLE "song_collections"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9732c95a9059b9e8563ca640d3"`,
    );
    await queryRunner.query(`DROP TABLE "song_lines"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3176758d8e1d4a30f5de3d7e21"`,
    );
    await queryRunner.query(`DROP TABLE "songs"`);
  }
}
