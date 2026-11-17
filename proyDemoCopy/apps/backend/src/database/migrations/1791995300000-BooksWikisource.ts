import { MigrationInterface, QueryRunner } from 'typeorm'; // [TypeORM]: contrato de migración (up / down)
// [Migración · 2026-11-17 · Libros de Wikisource]: books.source ('gutenberg' | 'wikisource') + books.image_url (portada o imagen de Wikidata)
// [Idempotente]: IF NOT EXISTS / IF EXISTS

export class BooksWikisource1791995300000 implements MigrationInterface {
  name = 'BooksWikisource1791995300000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "source" varchar(12) NOT NULL DEFAULT 'gutenberg'`);
    await q.query(`ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "image_url" varchar(600)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "books" DROP COLUMN IF EXISTS "image_url"`);
    await q.query(`ALTER TABLE "books" DROP COLUMN IF EXISTS "source"`);
  }
}
