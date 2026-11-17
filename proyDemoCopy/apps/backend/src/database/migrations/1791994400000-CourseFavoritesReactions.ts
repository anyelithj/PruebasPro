import { MigrationInterface, QueryRunner } from 'typeorm'; // [TypeORM]: contrato de migración (up / down)
// [Migración · 2026-11-13 · Caso F]: ⭐ favorito y 👍/❤️ reacción SALEN de course_enrollments → course_favorites y course_reactions
// [Sin pérdida]: si las columnas antiguas existen se copian sus datos ANTES de borrarlas (en la BD de desarrollo había 0 favoritos y 0 reacciones)
// Regla al trasladar: un usuario con like Y love a la vez (antes era posible) conserva ❤️ love (la valoración más alta) → like y love pasan a ser excluyentes
// [Idempotente]: IF NOT EXISTS / IF EXISTS / ON CONFLICT → se puede ejecutar sobre una BD creada con `synchronize` | [Patrón]: Expand → Migrate → Contract

// [Función pura de infraestructura]: ¿existe la columna antigua en course_enrollments del esquema ACTIVO?
// `current_schema()` (PostgreSQL) respeta el search_path; `QueryRunner.hasColumn` (TypeORM) mira siempre el esquema por defecto
// y, con otro search_path, devolvía false → la migración borraba las columnas SIN copiar los datos (pérdida silenciosa)
async function hasLegacyColumn(q: QueryRunner, column: string): Promise<boolean> {
  const rows: unknown[] = await q.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'course_enrollments' AND column_name = $1`,
    [column], // Parámetro enlazado ($1): sin concatenar texto en el SQL
  );
  return rows.length > 0; // `length > 0` → booleano
}

export class CourseFavoritesReactions1791994400000 implements MigrationInterface {
  name = 'CourseFavoritesReactions1791994400000';

  public async up(q: QueryRunner): Promise<void> {
    // 1) Expand: tipo enum + dos tablas con PK compuesta (único por usuario y curso) y FK a courses
    await q.query(
      `DO $$ BEGIN CREATE TYPE "course_reaction_type" AS ENUM ('like', 'love'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    );
    await q.query(`CREATE TABLE IF NOT EXISTS "course_favorites" (
      "user_id" uuid NOT NULL,
      "course_id" uuid NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("user_id", "course_id"))`);
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_course_favorites_user_created" ON "course_favorites" ("user_id", "created_at")`,
    );
    await q.query(`CREATE TABLE IF NOT EXISTS "course_reactions" (
      "user_id" uuid NOT NULL,
      "course_id" uuid NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
      "type" "course_reaction_type" NOT NULL,
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("user_id", "course_id"))`);
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_course_reactions_course_type" ON "course_reactions" ("course_id", "type")`,
    );

    // 2) Migrate: solo si la BD aún tiene las columnas antiguas (consulta al esquema ACTIVO, ver `hasLegacyColumn`)
    if (await hasLegacyColumn(q, 'is_favorite')) {
      await q.query(`INSERT INTO "course_favorites" ("user_id", "course_id", "created_at")
        SELECT "user_id", "course_id", "updated_at" FROM "course_enrollments" WHERE "is_favorite" ON CONFLICT DO NOTHING`);
    }
    if (await hasLegacyColumn(q, 'reaction_like')) {
      // `CASE` (SQL): love tiene prioridad sobre like cuando estaban ambos marcados
      await q.query(`INSERT INTO "course_reactions" ("user_id", "course_id", "type", "updated_at")
        SELECT "user_id", "course_id", (CASE WHEN "reaction_love" THEN 'love' ELSE 'like' END)::"course_reaction_type", "updated_at"
        FROM "course_enrollments" WHERE "reaction_like" OR "reaction_love" ON CONFLICT DO NOTHING`);
    }

    // 3) Contract: la inscripción ya no guarda favorito ni reacciones
    await q.query(
      `ALTER TABLE "course_enrollments" DROP COLUMN IF EXISTS "is_favorite", DROP COLUMN IF EXISTS "reaction_like", DROP COLUMN IF EXISTS "reaction_love"`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    // Reversa sin pérdida: se recrean las columnas y se rellenan desde las tablas nuevas antes de borrarlas
    await q.query(`ALTER TABLE "course_enrollments"
      ADD COLUMN IF NOT EXISTS "is_favorite" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "reaction_like" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "reaction_love" boolean NOT NULL DEFAULT false`);
    // Favoritos/reacciones de cursos NO comprados no tenían fila de inscripción → se crea (así era el modelo anterior)
    await q.query(`INSERT INTO "course_enrollments" ("user_id", "course_id")
      SELECT "user_id", "course_id" FROM "course_favorites" UNION SELECT "user_id", "course_id" FROM "course_reactions"
      ON CONFLICT ("user_id", "course_id") DO NOTHING`);
    await q.query(
      `UPDATE "course_enrollments" e SET "is_favorite" = true FROM "course_favorites" f WHERE f."user_id" = e."user_id" AND f."course_id" = e."course_id"`,
    );
    await q.query(`UPDATE "course_enrollments" e SET "reaction_like" = (r."type" = 'like'), "reaction_love" = (r."type" = 'love')
      FROM "course_reactions" r WHERE r."user_id" = e."user_id" AND r."course_id" = e."course_id"`);
    await q.query(`DROP TABLE IF EXISTS "course_reactions"`);
    await q.query(`DROP TABLE IF EXISTS "course_favorites"`);
    await q.query(`DROP TYPE IF EXISTS "course_reaction_type"`);
  }
}
