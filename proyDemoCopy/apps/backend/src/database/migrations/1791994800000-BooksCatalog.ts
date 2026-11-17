import { MigrationInterface, QueryRunner } from 'typeorm'; // [TypeORM]: contrato de migración (up / down)
// [Migración · 2026-11-14 · RF-145/RF-146]: books + book_texts · books — ficha de los libros de dominio público vistos en el catálogo (caché de Gutendex, sin texto) | [Idempotente]

export class BooksCatalog1791994800000 implements MigrationInterface {
  name = 'BooksCatalog1791994800000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "books" (
      "id" int PRIMARY KEY,
      "title" varchar(500) NOT NULL,
      "authors" jsonb NOT NULL DEFAULT '[]',
      "languages" text[] NOT NULL DEFAULT '{}',
      "text_url" varchar(500),
      "download_count" int NOT NULL DEFAULT 0,
      "fetched_at" timestamptz NOT NULL DEFAULT now()
    )`);
    // [RF-146]: texto limpio por libro (capítulos → párrafos), descargado una sola vez bajo pedido
    await q.query(`CREATE TABLE IF NOT EXISTS "book_texts" (
      "book_id" int PRIMARY KEY,
      "language" varchar(2) NOT NULL,
      "chapters" jsonb NOT NULL,
      "fetched_at" timestamptz NOT NULL DEFAULT now()
    )`);
    // [RF-146]: traducción por párrafo (bajo demanda) · [RF-147]: progreso por usuario y libro
    await q.query(`CREATE TABLE IF NOT EXISTS "book_translations" (
      "book_id" int NOT NULL,
      "chapter" int NOT NULL,
      "paragraph" int NOT NULL,
      "target" varchar(2) NOT NULL,
      "text" text NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("book_id", "chapter", "paragraph", "target")
    )`);
    await q.query(`CREATE TABLE IF NOT EXISTS "book_progress" (
      "user_id" uuid NOT NULL,
      "book_id" int NOT NULL,
      "chapter" int NOT NULL DEFAULT 0,
      "paragraph" int NOT NULL DEFAULT 0,
      "sentence" int NOT NULL DEFAULT 0,
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("user_id", "book_id")
    )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "book_progress"`);
    await q.query(`DROP TABLE IF EXISTS "book_translations"`);
    await q.query(`DROP TABLE IF EXISTS "book_texts"`);
    await q.query(`DROP TABLE IF EXISTS "books"`);
  }
}
