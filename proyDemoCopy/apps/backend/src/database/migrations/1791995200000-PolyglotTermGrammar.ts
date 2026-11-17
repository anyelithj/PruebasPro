import { MigrationInterface, QueryRunner } from 'typeorm'; // [TypeORM]: contrato de migración (up / down)
// [Migración · 2026-11-16 · Regla obligatoria de vocabulario]: polyglot_terms.grammar (plural, género, contable, clasificador + pinyin)
// [Idempotente]: IF NOT EXISTS / IF EXISTS

export class PolyglotTermGrammar1791995200000 implements MigrationInterface {
  name = 'PolyglotTermGrammar1791995200000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "polyglot_terms" ADD COLUMN IF NOT EXISTS "grammar" varchar(160) NOT NULL DEFAULT ''`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "polyglot_terms" DROP COLUMN IF EXISTS "grammar"`);
  }
}
