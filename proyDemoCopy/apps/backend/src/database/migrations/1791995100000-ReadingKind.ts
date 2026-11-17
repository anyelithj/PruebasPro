import { MigrationInterface, QueryRunner } from 'typeorm'; // [TypeORM]: contrato de migración (up / down)
// [Migración · 2026-11-16 · Dictado]: reading_texts.kind ('reading' | 'dictation') — las lecturas existentes quedan como 'reading'
// [Idempotente]: IF NOT EXISTS / IF EXISTS

export class ReadingKind1791995100000 implements MigrationInterface {
  name = 'ReadingKind1791995100000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "reading_texts" ADD COLUMN IF NOT EXISTS "kind" varchar(10) NOT NULL DEFAULT 'reading'`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "reading_texts" DROP COLUMN IF EXISTS "kind"`);
  }
}
