import {
  openTestSchema,
  type TestSchema,
} from '../../helpers/postgres-test-schema'; // [DRY]: esquema temporal compartido
import { CourseFavoritesReactions1791994400000 } from '../../../src/database/migrations/1791994400000-CourseFavoritesReactions';
// [Integración migración · Caso F · 2026-11-13]: up/down contra PostgreSQL REAL en un ESQUEMA TEMPORAL (no toca las tablas de la app) que se borra al terminar
// Verifica: traslado sin pérdida (favoritos, like, love; like+love → love), columnas antiguas eliminadas y reversa (down) que restaura los datos
// Sin PostgreSQL accesible la prueba se omite con aviso (no falla en CI sin BD) | [Patrón]: Test Fixture aislado

const U1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const U2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const U3 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const C1 = '11111111-1111-4111-8111-111111111111';

describe('Migración CourseFavoritesReactions (PostgreSQL)', () => {
  jest.setTimeout(30_000); // Conexión real a PostgreSQL: con toda la suite en paralelo tarda más que los 5 s por defecto
  let db: TestSchema | null = null;
  let q: TestSchema['q'];
  const migration = new CourseFavoritesReactions1791994400000();
  const columnExists = (table: string, column: string) =>
    db!.columnExists(table, column);

  beforeAll(async () => {
    db = await openTestSchema('qa_mig');
    if (!db) return;
    q = db.q;
    // [Fixture]: forma ANTERIOR de la BD (solo las columnas que usa la migración)
    await q.query(`CREATE TABLE courses (id uuid PRIMARY KEY)`);
    await q.query(`CREATE TABLE course_enrollments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, course_id uuid NOT NULL REFERENCES courses(id),
      is_favorite boolean NOT NULL DEFAULT false, reaction_like boolean NOT NULL DEFAULT false, reaction_love boolean NOT NULL DEFAULT false,
      updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (user_id, course_id))`);
    await q.query(`INSERT INTO courses VALUES ($1)`, [C1]);
    await q.query(
      `INSERT INTO course_enrollments (user_id, course_id, is_favorite, reaction_like, reaction_love) VALUES ($1,$4,true,true,false), ($2,$4,false,true,true), ($3,$4,false,false,false)`,
      [U1, U2, U3, C1],
    );
  });

  afterAll(async () => db?.drop());

  it('up: traslada favoritos y reacciones sin pérdida y elimina las columnas antiguas', async () => {
    if (!db) return;
    await migration.up(q);
    expect(await q.query(`SELECT user_id FROM course_favorites`)).toEqual([
      { user_id: U1 },
    ]);
    expect(
      await q.query(
        `SELECT user_id, type FROM course_reactions ORDER BY user_id`,
      ),
    ).toEqual([
      { user_id: U1, type: 'like' },
      { user_id: U2, type: 'love' }, // Tenía like Y love → conserva love (excluyentes)
    ]);
    expect(await columnExists('course_enrollments', 'is_favorite')).toBe(false);
    await expect(
      q.query(
        `INSERT INTO course_reactions (user_id, course_id, type) VALUES ($1,$2,'wow')`,
        [U3, C1],
      ),
    ).rejects.toThrow(); // El enum rechaza otros tipos
    await expect(
      q.query(
        `INSERT INTO course_favorites (user_id, course_id) VALUES ($1,$2)`,
        [U1, C1],
      ),
    ).rejects.toThrow(); // PK: único por usuario y curso
  });

  it('down: restaura las columnas con los mismos datos', async () => {
    if (!db) return;
    await migration.down(q);
    expect(
      await q.query(
        `SELECT user_id::text, is_favorite, reaction_like, reaction_love FROM course_enrollments ORDER BY user_id`,
      ),
    ).toEqual([
      {
        user_id: U1,
        is_favorite: true,
        reaction_like: true,
        reaction_love: false,
      },
      {
        user_id: U2,
        is_favorite: false,
        reaction_like: false,
        reaction_love: true,
      },
      {
        user_id: U3,
        is_favorite: false,
        reaction_like: false,
        reaction_love: false,
      },
    ]);
    expect(await columnExists('course_favorites', 'user_id')).toBe(false); // Tabla eliminada
  });
});
