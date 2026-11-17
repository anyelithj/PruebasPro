import { CuratedArticleRules1791994600000 } from '../../../src/database/migrations/1791994600000-CuratedArticleRules';
import { curatedGrammar } from '../../../src/modules/curriculum/domain/content/grammar-templates';
import { Language } from '../../../src/shared/domain/language.vo';
import {
  openTestSchema,
  type TestSchema,
} from '../../helpers/postgres-test-schema';
// [Integración · Caso D · 2026-11-13]: corrección de las fichas a/an/the contra PostgreSQL real (esquema temporal) — up idempotente y down reversible

const A = {
  title: "Use 'a' antes de consonantes sonoros",
  structure: 'a + consonante sonora',
  explanationEs: 'x',
  examples: [],
};
const AN = {
  title: "Use 'an' antes de consonantes no sonoros",
  structure: 'an + consonante no sonora',
  explanationEs: 'x',
  examples: [{ text: 'an umbrella', translationEs: 'una paraguas' }],
};
const THE = {
  title: "Use 'the' antes de sustantivos específicos",
  structure: 'the + sustantivo',
  explanationEs: 'x',
  examples: [],
};
const MANUAL = {
  title: "Use 'a' (escrita a mano)",
  structure: 'a',
  explanationEs: 'x',
  examples: [],
};

describe('Migración CuratedArticleRules (PostgreSQL)', () => {
  jest.setTimeout(30_000); // Conexión real: con toda la suite en paralelo tarda más que los 5 s por defecto
  let db: TestSchema | null = null;
  const migration = new CuratedArticleRules1791994600000();
  const rows = async () =>
    (await db!.q.query(
      `SELECT id, content, review_status, version, review_note FROM curriculum_items ORDER BY id`,
    )) as Array<{
      id: string;
      content: { title: string };
      review_status: string;
      version: number;
      review_note: string | null;
    }>; // fmt: skip

  beforeAll(async () => {
    db = await openTestSchema('qa_caso_d');
    if (!db) return;
    // [Fixture]: solo las columnas que usa la migración
    await db.q
      .query(`CREATE TABLE curriculum_items (id text PRIMARY KEY, kind text, language text, provenance text, topic text, content jsonb,
      review_status text, version int, review_note text, reviewed_by uuid, reviewed_at timestamptz, updated_at timestamptz)`);
    const insert = (id: string, content: object, provenance = 'generated') =>
      db!.q.query(
        `INSERT INTO curriculum_items VALUES ($1, 'grammar_rule', 'en', $2, 'Articles', $3, 'approved', 4, NULL, NULL, now(), now())`,
        [id, provenance, JSON.stringify(content)],
      );
    await insert('1-a', A);
    await insert('2-an', AN);
    await insert('3-the', THE);
    await insert('4-manual', MANUAL, 'manual'); // Escrita por un docente: no se toca
  });
  afterAll(async () => db?.drop());

  it('up: plantillas curadas, vuelven a revisión y guarda el contenido anterior; es idempotente', async () => {
    if (!db) return;
    await migration.up(db.q);
    const [a, an, the, manual] = await rows();
    const [ta, tan, tthe] = curatedGrammar(Language.EN, 'Articles')!;
    expect([a!.content.title, an!.content.title, the!.content.title]).toEqual([
      ta!.title,
      tan!.title,
      tthe!.title,
    ]);
    expect(
      [a, an, the].every(
        (r) => r!.review_status === 'review_required' && r!.version === 5,
      ),
    ).toBe(true); // Despublicadas hasta revisión docente
    expect(JSON.stringify(an!.content)).not.toMatch(/sonor|una paraguas/);
    expect(an!.review_note).toContain('una paraguas'); // Contenido anterior conservado (reversible)
    expect(manual).toMatchObject({ review_status: 'approved', version: 4 });
    await migration.up(db.q);
    expect((await rows())[0]!.version).toBe(5); // Segunda ejecución: no vuelve a tocar nada
  });

  it('down: restaura el contenido anterior (sin republicar)', async () => {
    if (!db) return;
    await migration.down(db.q);
    const [a, an] = await rows();
    expect(a!.content.title).toBe(A.title);
    expect(an!.content).toEqual(AN);
    expect(a!.review_note).toBeNull();
  });
});
