import { UnprocessableEntityException } from '@nestjs/common';
import { curatedGrammar } from '../../../src/modules/curriculum/domain/content/grammar-templates';
import {
  languageMismatch,
  validateCurriculumContent,
} from '../../../src/modules/curriculum/domain/content/curriculum-content.schema';
import { GenerateContentDraftQuery } from '../../../src/modules/curriculum/application/queries/ai-draft.queries';
import { BulkPublishCommand } from '../../../src/modules/curriculum/application/commands/bulk-publish.command';
import { ChangeReviewStatusCommand } from '../../../src/modules/curriculum/application/commands/change-review-status.command';
import {
  mustBeReviewed,
  publishSteps,
  ReviewStatus,
} from '../../../src/modules/curriculum/domain/value-objects/review-status.vo';
import { Provenance } from '../../../src/modules/curriculum/domain/value-objects/provenance.vo';
import { CurriculumItemKind } from '../../../src/modules/curriculum/domain/value-objects/curriculum-item-kind.vo';
import { Language } from '../../../src/shared/domain/language.vo';
import { CefrLevel } from '../../../src/shared/domain/cefr-level.vo';
import { LanguageSkill } from '../../../src/shared/domain/language-skill.vo';
import { Role } from '../../../src/modules/users/domain/value-objects/role.vo';
// [Caso D · 2026-11-13 · RNF-37]: reglas de gramática curadas (7 idiomas), borrador sin LLM y publicación bloqueada sin revisión docente
// [Patrón]: Table-Driven + Test Double (repositorios en memoria, LLM espía)

describe('Plantillas de gramática curadas (7 idiomas)', () => {
  it.each(Object.values(Language))(
    '«artículos» en %s: válidas, en el idioma correcto y con ejemplos',
    (language) => {
      const rules = curatedGrammar(language, 'Los artículos');
      expect(rules?.length).toBeGreaterThan(0);
      for (const rule of rules!) {
        const r = validateCurriculumContent(
          CurriculumItemKind.GRAMMAR_RULE,
          structuredClone(rule),
        );
        expect(r.ok).toBe(true); // Mismo esquema que el contenido manual
        expect(
          languageMismatch(language, structuredClone(rule) as never),
        ).toBeNull(); // Ejemplos en la escritura del idioma
        expect(rule.examples.length).toBeGreaterThanOrEqual(3);
      }
    },
  );

  it('a/an según el SONIDO (an hour, a university), nunca «consonantes sonoras»', () => {
    const [a, an] = curatedGrammar(Language.EN, 'Articles')!;
    expect(a!.structure).toMatch(/SONIDO de consonante/);
    expect(an!.structure).toMatch(/SONIDO de vocal/);
    expect(an!.examples.map((e) => e.text)).toEqual(
      expect.arrayContaining(['an hour', 'an umbrella']),
    );
    expect(a!.examples.map((e) => e.text)).toContain('a university');
    expect(JSON.stringify(curatedGrammar(Language.EN, 'Articles'))).not.toMatch(
      /sonor|una paraguas/i,
    );
  });

  it.each([
    [Language.EN, 'Los artículos (a / an / the)'],
    [Language.FR, 'Los artículos definidos e indefinidos'],
    [Language.DE, 'Los artículos (der / die / das)'],
    [Language.EN, 'Articles'],
    [Language.RU, 'Артикли'],
  ])(
    'reconoce el tema del catálogo o del docente (%s · %s)',
    (language, topic) => {
      expect(curatedGrammar(language, topic)).not.toBeNull();
    },
  );

  it('sin plantilla para otros temas → null (los propone la IA y pasan por revisión)', () => {
    expect(curatedGrammar(Language.EN, 'El presente perfecto')).toBeNull();
  });
});

describe('Borrador de regla gramatical con plantilla (sin LLM)', () => {
  const items = (existing: Array<Record<string, unknown>> = []) => ({
    findByNaturalKey: jest.fn().mockResolvedValue(null),
    search: jest
      .fn()
      .mockResolvedValue({
        data: existing.map((content) => ({ content })),
        total: existing.length,
        page: 1,
        limit: 100,
      }),
  });
  const llm = { generateJson: jest.fn() };
  const make = (repo = items()) =>
    new GenerateContentDraftQuery(
      llm as never,
      repo as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
    );
  const req = {
    language: Language.EN,
    level: CefrLevel.A1,
    skill: LanguageSkill.GRAMMAR,
    kind: CurriculumItemKind.GRAMMAR_RULE,
    topic: 'Articles',
    count: 3,
    force: true,
  };

  it('devuelve las reglas curadas y NO llama al modelo', async () => {
    const r = await make().execute(req, 'u1');
    expect(r.strategy).toBe('template');
    expect(r.drafts.map((d) => d.content.title)).toEqual([
      'Artículo indefinido «a»',
      'Artículo indefinido «an»',
      'Artículo definido «the»',
    ]);
    expect(llm.generateJson).not.toHaveBeenCalled();
  });

  it('omite las que el tema ya tiene y avisa cuando ya están todas', async () => {
    const [a, an, the] = curatedGrammar(Language.EN, 'Articles')!;
    const r = await make(items([{ ...a }])).execute(req, 'u1');
    expect(r.drafts.map((d) => d.content.title)).toEqual([
      an!.title,
      the!.title,
    ]);
    await expect(
      make(items([{ ...a }, { ...an }, { ...the }])).execute(req, 'u1'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});

describe('Publicación bloqueada sin revisión docente (RNF-37)', () => {
  it('contenido de IA solo se publica desde «revisado»; lo manual mantiene su recorrido', () => {
    expect(
      publishSteps(ReviewStatus.GENERATED, true, Provenance.GENERATED),
    ).toBeNull();
    expect(
      publishSteps(ReviewStatus.REVIEW_REQUIRED, true, Provenance.GENERATED),
    ).toBeNull();
    expect(
      publishSteps(ReviewStatus.REVIEWED, true, Provenance.GENERATED),
    ).toEqual([ReviewStatus.APPROVED]);
    expect(publishSteps(ReviewStatus.DRAFT, true, Provenance.MANUAL)).toEqual([
      ReviewStatus.REVIEW_REQUIRED,
      ReviewStatus.REVIEWED,
      ReviewStatus.APPROVED,
    ]);
    expect(
      publishSteps(ReviewStatus.APPROVED, false, Provenance.GENERATED),
    ).toEqual([ReviewStatus.DRAFT]); // Despublicar siempre se puede
    expect(mustBeReviewed(ReviewStatus.APPROVED, Provenance.GENERATED)).toBe(
      false,
    );
  });

  it('el lote informa el motivo y publica el resto', async () => {
    const db = new Map<string, Record<string, unknown>>([
      [
        'ia',
        {
          id: 'ia',
          reviewStatus: ReviewStatus.GENERATED,
          provenance: Provenance.GENERATED,
          version: 1,
          createdBy: 'a1',
        },
      ],
      [
        'ok',
        {
          id: 'ok',
          reviewStatus: ReviewStatus.REVIEWED,
          provenance: Provenance.GENERATED,
          version: 1,
          createdBy: 'a1',
          reviewedBy: 't1',
        },
      ],
    ]);
    const repo = {
      findById: jest.fn(async (id: string) =>
        db.has(id) ? { ...db.get(id)! } : null,
      ),
      saveWithRevision: jest.fn(
        async (item: { id: string; version: number }) => {
          const saved = { ...item, version: item.version + 1 };
          db.set(item.id, saved);
          return saved;
        },
      ),
    };
    const r = await new BulkPublishCommand(
      repo as never,
      new ChangeReviewStatusCommand(repo as never),
    ).execute(['ia', 'ok'], true, { id: 'a1', role: Role.ADMIN });
    expect(r.changed).toBe(1);
    expect(r.failed).toEqual([
      { id: 'ia', message: expect.stringMatching(/revisado/) },
    ]);
    expect(db.get('ia')!.reviewStatus).toBe(ReviewStatus.GENERATED);
  });
});
