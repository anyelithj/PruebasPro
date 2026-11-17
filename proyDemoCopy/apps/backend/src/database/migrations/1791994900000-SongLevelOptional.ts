import { MigrationInterface, QueryRunner } from 'typeorm'; // [TypeORM]: contrato de migración (up / down)
// [Migración · 2026-11-16 · RF-148]: songs.level admite NULL — la canción nace sin nivel y se estima de la letra al cargarla (LevelClassifier)
// Sin nivel no se publica (blocker «level») | [Idempotente]: DROP NOT NULL no falla si ya es nullable

export class SongLevelOptional1791994900000 implements MigrationInterface {
  name = 'SongLevelOptional1791994900000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "songs" ALTER COLUMN "level" DROP NOT NULL`);
  }

  // [down]: las canciones sin nivel (borradores sin letra) vuelven a A1 para poder restaurar NOT NULL
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`UPDATE "songs" SET "level" = 'A1' WHERE "level" IS NULL`);
    await q.query(`ALTER TABLE "songs" ALTER COLUMN "level" SET NOT NULL`);
  }
}
