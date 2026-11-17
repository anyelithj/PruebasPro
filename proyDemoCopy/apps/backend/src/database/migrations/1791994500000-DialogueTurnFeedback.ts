import { MigrationInterface, QueryRunner } from 'typeorm'; // [TypeORM]: contrato de migración (up / down)
// [Migración · 2026-11-13 · Anexo A]: dialogue_turns.feedback (jsonb) = corrección pedagógica ÚNICA del turno del usuario
// (frase corregida, veredicto, errores, traducción, puntuación y trazabilidad: modelo + versión del prompt · RNF-35)
// `correction` (texto) se conserva para los turnos anteriores | [Idempotente]: IF NOT EXISTS / IF EXISTS

export class DialogueTurnFeedback1791994500000 implements MigrationInterface {
  name = 'DialogueTurnFeedback1791994500000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "dialogue_turns" ADD COLUMN IF NOT EXISTS "feedback" jsonb`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "dialogue_turns" DROP COLUMN IF EXISTS "feedback"`,
    );
  }
}
