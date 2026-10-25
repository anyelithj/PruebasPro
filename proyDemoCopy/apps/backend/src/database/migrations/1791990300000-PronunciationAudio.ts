import { MigrationInterface, QueryRunner } from 'typeorm';

export class PronunciationAudio1791990300000 implements MigrationInterface {
  name = 'PronunciationAudio1791990300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."pronunciation_audio_language_enum" AS ENUM('en', 'es', 'fr', 'de', 'pt', 'zh', 'ru')`,
    );
    await queryRunner.query(
      `CREATE TABLE "pronunciation_audio" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "cache_key" character(64) NOT NULL, "text" character varying(300) NOT NULL, "language" "public"."pronunciation_audio_language_enum" NOT NULL, "variant" character varying(20) NOT NULL, "voice" character varying(40) NOT NULL, "engine" character varying(40) NOT NULL, "object_key" character varying(200) NOT NULL, "size_bytes" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_03b6dbb69c0528d193e7b09ac37" UNIQUE ("cache_key"), CONSTRAINT "PK_9e5c5eaf38fe5bd7799accecbe0" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "pronunciation_audio"`);
    await queryRunner.query(
      `DROP TYPE "public"."pronunciation_audio_language_enum"`,
    );
  }
}
