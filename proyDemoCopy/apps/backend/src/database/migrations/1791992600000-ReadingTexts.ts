import { MigrationInterface, QueryRunner } from 'typeorm';
// [Migración ReadingTexts · Lectura · 2026-10-25]: tablas reading_texts (texto por género/idioma/nivel), reading_sentences (frase con traducción e IPA) y reading_progress (marcador por usuario)
// [Patrón]: Migration (DDL versionado) | `IF NOT EXISTS`: idempotente (no falla si synchronize ya creó las tablas en desarrollo) | FK con ON DELETE CASCADE: borrar un texto borra sus frases y marcadores

export class ReadingTexts1791992600000 implements MigrationInterface {
  name = 'ReadingTexts1791992600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "reading_texts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(160) NOT NULL, "language" character varying(2) NOT NULL, "level" character varying(2) NOT NULL, "genre" character varying(20) NOT NULL, "topic" character varying(160), "summary" character varying(600), "status" character varying(10) NOT NULL DEFAULT 'draft', "source" character varying(10) NOT NULL DEFAULT 'manual', "source_ref" character varying(300), "sentence_count" integer NOT NULL DEFAULT 0, "word_count" integer NOT NULL DEFAULT 0, "created_by" uuid NOT NULL, "withdrawn_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_reading_texts" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_reading_texts_filters" ON "reading_texts" ("language", "level", "genre", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_reading_texts_created_by" ON "reading_texts" ("created_by")`);
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "reading_sentences" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "text_id" uuid NOT NULL, "paragraph" integer NOT NULL, "position" integer NOT NULL, "text" text NOT NULL, "translation" text, "ipa" text NOT NULL DEFAULT '', "ipa_us" text, "reviewed" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_reading_sentences" PRIMARY KEY ("id"), CONSTRAINT "FK_reading_sentences_text" FOREIGN KEY ("text_id") REFERENCES "reading_texts"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_reading_sentences_text_position" ON "reading_sentences" ("text_id", "position")`);
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "reading_progress" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "text_id" uuid NOT NULL, "sentence_index" integer NOT NULL DEFAULT 0, "word_index" integer NOT NULL DEFAULT 0, "finished" boolean NOT NULL DEFAULT false, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_reading_progress" PRIMARY KEY ("id"), CONSTRAINT "UQ_reading_progress_user_text" UNIQUE ("user_id", "text_id"), CONSTRAINT "FK_reading_progress_text" FOREIGN KEY ("text_id") REFERENCES "reading_texts"("id") ON DELETE CASCADE)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "reading_progress"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reading_sentences_text_position"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reading_sentences"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reading_texts_created_by"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reading_texts_filters"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reading_texts"`);
  }
}
