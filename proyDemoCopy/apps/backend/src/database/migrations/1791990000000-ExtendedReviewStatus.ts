import type { MigrationInterface, QueryRunner } from 'typeorm';
// [Migración Etapa 2 (especificación MCER) · Sprint 4.3]: estados editoriales ampliados del currículo | [Patrón]: Command (up/down reversibles) | [Principio]: Reproducibilidad + Fail Fast
// Escrita a mano (no generada): PostgreSQL no permite quitar valores de un ENUM y la conversión de datos debe ser explícita
// draft · in_review · approved · rejected · archived  →  draft · generated · review_required · reviewed · approved · archived

const TYPE = '"public"."curriculum_items_review_status_enum"'; // Tipo ENUM de la columna curriculum_items.review_status
const OLD = '"public"."curriculum_items_review_status_enum_old"'; // Nombre temporal del tipo anterior

export class ExtendedReviewStatus1791990000000 implements MigrationInterface {
  name = 'ExtendedReviewStatus1791990000000'; // Identificador que TypeORM guarda en typeorm_migrations

  // `async up` (TypeORM): aplica el cambio; corre dentro de una transacción
  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.swapEnum(
      queryRunner,
      [
        'draft',
        'generated',
        'review_required',
        'reviewed',
        'approved',
        'archived',
      ],
      // `CASE` (SQL): in_review → review_required · rejected → draft (la devolución queda en el historial de revisiones)
      `CASE "review_status"::text WHEN 'in_review' THEN 'review_required' WHEN 'rejected' THEN 'draft' ELSE "review_status"::text END`,
    );
    // [Regla de la especificación]: un borrador que vino de la IA y nadie revisó se marca GENERATED (nunca se presenta como verificado)
    await queryRunner.query(
      `UPDATE "curriculum_items" SET "review_status" = 'generated' WHERE "review_status" = 'draft' AND "generation_id" IS NOT NULL`,
    );
  }

  // `async down` (TypeORM): deshace el cambio con la conversión inversa (generated → draft · review_required/reviewed → in_review)
  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.swapEnum(
      queryRunner,
      ['draft', 'in_review', 'approved', 'rejected', 'archived'],
      `CASE "review_status"::text WHEN 'generated' THEN 'draft' WHEN 'review_required' THEN 'in_review' WHEN 'reviewed' THEN 'in_review' ELSE "review_status"::text END`,
    );
  }

  // [swapEnum]: renombra el tipo viejo, crea el nuevo, convierte la columna con `USING` y borra el viejo | [Principio]: DRY (up y down usan el mismo procedimiento)
  private async swapEnum(
    queryRunner: QueryRunner,
    values: ReadonlyArray<string>,
    convert: string,
  ): Promise<void> {
    const list = values.map((v) => `'${v}'`).join(', '); // Valores fijos del código (no entrada de usuario)
    await queryRunner.query(
      `ALTER TYPE ${TYPE} RENAME TO "curriculum_items_review_status_enum_old"`,
    );
    await queryRunner.query(`CREATE TYPE ${TYPE} AS ENUM(${list})`);
    await queryRunner.query(
      `ALTER TABLE "curriculum_items" ALTER COLUMN "review_status" DROP DEFAULT`,
    ); // El default usa el tipo viejo
    await queryRunner.query(
      `ALTER TABLE "curriculum_items" ALTER COLUMN "review_status" TYPE ${TYPE} USING (${convert})::${TYPE}`,
    );
    await queryRunner.query(
      `ALTER TABLE "curriculum_items" ALTER COLUMN "review_status" SET DEFAULT 'draft'`,
    );
    await queryRunner.query(`DROP TYPE ${OLD}`);
  }
}
