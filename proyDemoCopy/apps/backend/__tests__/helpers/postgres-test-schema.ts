import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource, type QueryRunner } from 'typeorm';
// [Test helper · 2026-11-13]: conexión a PostgreSQL REAL en un ESQUEMA TEMPORAL (no toca las tablas de la app) para probar migraciones
// Sin BD accesible devuelve null y la prueba se omite con aviso (CI sin PostgreSQL no falla) | [Patrón]: Test Fixture aislado | [Principio]: DRY (lo usan todas las pruebas de migración)

// [dbEnv]: DATABASE_* del entorno o, si faltan, del .env del backend (mismas claves que database.config.ts)
function dbEnv(key: string, fallback: string): string {
  if (process.env[key]) return process.env[key]!;
  const file = join(__dirname, '../../.env');
  const line = existsSync(file)
    ? readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .find((l) => l.startsWith(`${key}=`))
    : undefined;
  return line ? line.slice(key.length + 1).trim() : fallback;
}

export interface TestSchema {
  readonly q: QueryRunner; // Una sola conexión → el search_path vale para todas las consultas
  readonly schema: string;
  columnExists(table: string, column: string): Promise<boolean>; // hasColumn de TypeORM mira `public`, no el esquema temporal
  drop(): Promise<void>;
}

export async function openTestSchema(
  prefix: string,
): Promise<TestSchema | null> {
  const ds = new DataSource({
    type: 'postgres',
    host: dbEnv('DATABASE_HOST', 'localhost'),
    port: Number(dbEnv('DATABASE_PORT', '5432')),
    username: dbEnv('DATABASE_USER', 'postgres'),
    password: dbEnv('DATABASE_PASSWORD', 'postgres'),
    database: dbEnv('DATABASE_NAME', 'languageproject'),
  });
  try {
    await ds.initialize();
  } catch {
    console.warn(
      'PostgreSQL no disponible: se omite la prueba de la migración',
    );
    return null;
  }
  const schema = `${prefix}_${Date.now()}`;
  const q = ds.createQueryRunner();
  await q.connect();
  await q.query(`CREATE SCHEMA "${schema}"`);
  await q.query(`SET search_path TO "${schema}"`);
  return {
    q,
    schema,
    columnExists: async (table, column) =>
      (
        await q.query(
          `SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
          [schema, table, column],
        )
      ).length > 0,
    drop: async () => {
      await q.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); // Limpieza total del fixture
      await q.release();
      await ds.destroy();
    },
  };
}
