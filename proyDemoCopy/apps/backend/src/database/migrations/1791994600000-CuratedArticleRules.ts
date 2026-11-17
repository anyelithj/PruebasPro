import { MigrationInterface, QueryRunner } from 'typeorm'; // [TypeORM]: contrato de migración (up / down)
import { curatedGrammar } from '../../modules/curriculum/domain/content/grammar-templates';
import { Language } from '../../shared/domain/language.vo';
// [Migración de datos · 2026-11-13 · Caso D · RNF-37]: las fichas a/an/the de inglés generadas por IA decían «a antes de consonantes sonoras /
// an antes de consonantes no sonoras» (falso: lo que decide es el SONIDO inicial: a university, an hour) y «una paraguas».
// → su contenido pasa a las plantillas curadas, vuelven a «review_required» (dejan de verse en el catálogo) hasta que un docente las revise,
// y el contenido anterior queda en `review_note` para poder revertir | [Idempotente]: solo toca fichas de IA aún no corregidas

const MARK = 'Corregido con plantilla curada (Caso D). Contenido anterior: '; // Prefijo de la nota → identifica lo ya migrado
// [pick]: «Use 'an' antes…» → 2.ª plantilla · «'a'» → 1.ª · «'the'» → 3.ª | `RegExp.test` (JS) | Función pura
const pick = (title: string): number =>
  /['«]an['»]/i.test(title)
    ? 1
    : /['«]a['»]/i.test(title)
      ? 0
      : /['«]the['»]/i.test(title)
        ? 2
        : -1;

export class CuratedArticleRules1791994600000 implements MigrationInterface {
  name = 'CuratedArticleRules1791994600000';

  public async up(q: QueryRunner): Promise<void> {
    const templates = curatedGrammar(Language.EN, 'articles') ?? [];
    type Row = {
      id: string;
      content: { title?: string };
      review_note: string | null;
    };
    const rows = (await q.query(
      `SELECT id, content, review_note FROM curriculum_items
        WHERE kind = 'grammar_rule' AND language = 'en' AND provenance = 'generated'
          AND (topic ILIKE '%article%' OR topic ILIKE '%artícul%' OR topic ILIKE '%articul%')
          AND coalesce(review_note, '') NOT LIKE $1`,
      [`${MARK}%`],
    )) as Row[]; // `as` (TS): `query` devuelve any → se fija la forma de las filas
    for (const row of rows) {
      const template = templates[pick(row.content?.title ?? '')];
      if (!template) continue; // Ficha de artículos que no es a / an / the → se deja para revisión manual
      await q.query(
        `UPDATE curriculum_items SET content = $2::jsonb, review_status = 'review_required', version = version + 1,
                review_note = $3, reviewed_by = NULL, reviewed_at = NULL, updated_at = now()
          WHERE id = $1`,
        [
          row.id,
          JSON.stringify(template),
          `${MARK}${JSON.stringify(row.content)}`,
        ],
      );
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    // Restaura el contenido anterior guardado en la nota (queda en revisión: no se vuelve a publicar automáticamente)
    await q.query(
      `UPDATE curriculum_items SET content = substring(review_note FROM $2::int)::jsonb, review_note = NULL, version = version + 1, updated_at = now()
        WHERE review_note LIKE $1`,
      [`${MARK}%`, MARK.length + 1],
    );
  }
}
