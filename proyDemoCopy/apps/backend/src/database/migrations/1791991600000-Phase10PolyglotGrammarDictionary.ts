import { MigrationInterface, QueryRunner } from 'typeorm';
// [Migración · Fase 10 · Sprints 10.2/10.5/10.9]: estado «aprendiendo/aprendido» del diccionario (vocabulary_entries.status), poliglota (polyglot_topics, polyglot_concepts, polyglot_terms, polyglot_views) y gramática (grammar_topics, grammar_sections, grammar_examples) | [Patrón]: Migration (up/down reversible) — nombres de PK e índices con DefaultNamingStrategy de TypeORM (iguales a los de `synchronize`)

export class Phase10PolyglotGrammarDictionary1791991600000 implements MigrationInterface {
  name = 'Phase10PolyglotGrammarDictionary1791991600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "vocabulary_entries" ADD "status" character varying(8)`,
    );
    await queryRunner.query(
      `CREATE TABLE "polyglot_topics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "slug" character varying(60) NOT NULL, "title" character varying(120) NOT NULL, "emoji" character varying(16) NOT NULL DEFAULT '🌍', "description" text NOT NULL DEFAULT '', "language" character varying(2), "levels" jsonb NOT NULL DEFAULT '[]', "status" character varying(10) NOT NULL DEFAULT 'draft', "created_by" uuid, "archived_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_18c684a69cc73a36e5ccc7bf8cd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_4bd601eb52c361f82226591b6a" ON "polyglot_topics" ("slug") `,
    );
    await queryRunner.query(
      `CREATE TABLE "polyglot_concepts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "topic_id" uuid NOT NULL, "position" integer NOT NULL DEFAULT '0', "kind" character varying(6) NOT NULL DEFAULT 'word', "emoji" character varying(16) NOT NULL DEFAULT '', "image_url" character varying(400), "image_license" character varying(300), "gloss" character varying(160) NOT NULL DEFAULT '', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d467e3a4bf3f4bad98c053e36c1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_52528bf63ff7859ee1404b7be1" ON "polyglot_concepts" ("topic_id", "position") `,
    );
    await queryRunner.query(
      `CREATE TABLE "polyglot_terms" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "concept_id" uuid NOT NULL, "language" character varying(2) NOT NULL, "text" character varying(200) NOT NULL, "ipa" character varying(300) NOT NULL DEFAULT '', "ipa_us" character varying(300), "reviewed" boolean NOT NULL DEFAULT false, "needs_native_review" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_812247b5d142673b82fc57bc5b5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_2e5a205be9b7bf3cc3ef5753dd" ON "polyglot_terms" ("concept_id", "language") `,
    );
    await queryRunner.query(
      `CREATE TABLE "polyglot_views" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "topic_id" uuid NOT NULL, "name" character varying(120) NOT NULL DEFAULT '', "languages" jsonb NOT NULL DEFAULT '[]', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e5dd6e08489bd4b3cdb23d8af48" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8605cebe386b2a44232fac3efb" ON "polyglot_views" ("user_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "grammar_topics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "slug" character varying(60) NOT NULL, "title" character varying(120) NOT NULL, "summary" text NOT NULL DEFAULT '', "language" character varying(2), "levels" jsonb NOT NULL DEFAULT '[]', "status" character varying(10) NOT NULL DEFAULT 'draft', "model" character varying(40), "created_by" uuid, "archived_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ecaf2e5fdb7b1ba5d216d030d83" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_b23c6b6f3ac2262875b125b306" ON "grammar_topics" ("slug") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5d8d974a9c276a671ca1f58424" ON "grammar_topics" ("language", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "grammar_sections" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "topic_id" uuid NOT NULL, "position" integer NOT NULL DEFAULT '0', "type" character varying(16) NOT NULL, "title" character varying(120) NOT NULL DEFAULT '', "body" text NOT NULL DEFAULT '', CONSTRAINT "PK_ba4161bd1058dc1265ebf28e565" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b4859c5bb012ce1bff00676d32" ON "grammar_sections" ("topic_id", "position") `,
    );
    await queryRunner.query(
      `CREATE TABLE "grammar_examples" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "section_id" uuid NOT NULL, "position" integer NOT NULL DEFAULT '0', "text" text NOT NULL, "ipa" text NOT NULL DEFAULT '', "ipa_us" text, "translation" text, "reviewed" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_0dc122d4415ec4ec72bdf0eb0bf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_16a0fc3d8066cc23422711f516" ON "grammar_examples" ("section_id", "position") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_16a0fc3d8066cc23422711f516"`);
    await queryRunner.query(`DROP TABLE "grammar_examples"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b4859c5bb012ce1bff00676d32"`);
    await queryRunner.query(`DROP TABLE "grammar_sections"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_5d8d974a9c276a671ca1f58424"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b23c6b6f3ac2262875b125b306"`);
    await queryRunner.query(`DROP TABLE "grammar_topics"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_8605cebe386b2a44232fac3efb"`);
    await queryRunner.query(`DROP TABLE "polyglot_views"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2e5a205be9b7bf3cc3ef5753dd"`);
    await queryRunner.query(`DROP TABLE "polyglot_terms"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_52528bf63ff7859ee1404b7be1"`);
    await queryRunner.query(`DROP TABLE "polyglot_concepts"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4bd601eb52c361f82226591b6a"`);
    await queryRunner.query(`DROP TABLE "polyglot_topics"`);
    await queryRunner.query(`ALTER TABLE "vocabulary_entries" DROP COLUMN "status"`);
  }
}
