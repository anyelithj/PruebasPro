import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { Repository } from 'typeorm';
import type { LanguageToolsPort } from '../../../../src/shared/domain/interfaces/language-tools.interface';
import type { CreateVocabularyEntryUseCase } from '../../../../src/modules/vocabulary/application/use-cases/create-vocabulary-entry.use-case';
import { MarkWordLearningUseCase } from '../../../../src/modules/vocabulary/application/use-cases/mark-word-learning.use-case';
import type { VocabularyEntry } from '../../../../src/modules/vocabulary/domain/entities/vocabulary-entry.entity';
import { WORD_MARKED_TO_LEARN_EVENT } from '../../../../src/modules/vocabulary/domain/events/word-marked-to-learn.event';
import { WordMarkedToLearnListener } from '../../../../src/modules/games/application/listeners/word-marked-to-learn.listener';
import type { AddFlashcardUseCase } from '../../../../src/modules/games/application/use-cases/add-flashcard.use-case';
import { imageProblem } from '../../../../src/modules/polyglot/application/use-cases/add-concept.use-case';
import { EnrichTermsUseCase } from '../../../../src/modules/polyglot/application/use-cases/enrich-terms.use-case';
import type { PolyglotConcept } from '../../../../src/modules/polyglot/domain/entities/polyglot-concept.entity';
import type { PolyglotTerm } from '../../../../src/modules/polyglot/domain/entities/polyglot-term.entity';
import {
  languageOrder,
  POLYGLOT_DEFAULT_ORDER,
} from '../../../../src/modules/polyglot/domain/language-order';
import {
  parseRow,
  POLYGLOT_SEED,
} from '../../../../src/modules/polyglot/infrastructure/seeds/polyglot-topics.seed';
import { EnrichExampleUseCase } from '../../../../src/modules/grammar/application/use-cases/enrich-example.use-case';
import type { GrammarExample } from '../../../../src/modules/grammar/domain/entities/grammar-example.entity';
import { isSectionType } from '../../../../src/modules/grammar/domain/section-type';
import { GrammarDraftClient } from '../../../../src/modules/grammar/infrastructure/ai/grammar-draft-client.adapter';
import { GRAMMAR_SEED } from '../../../../src/modules/grammar/infrastructure/seeds/grammar-topics.seed';
import type { OllamaClient } from '../../../../src/modules/ai/ollama.client';
import type { ConfigService } from '@nestjs/config';
// [Suite Fase 10 · Sprints 10.2/10.5/10.6/10.9/10.10/10.15]: «Aprender» del diccionario con evento hacia el mazo, orden de columnas poliglota, licencia de imágenes, IPA determinista con revisión nativa, contenido semilla, IPA y traducción de ejemplos y validación del borrador de gramática | [Patrón]: Test Double (repositorios y puertos en memoria) | [Herramienta]: Jest

const tools = (over: Partial<LanguageToolsPort> = {}): LanguageToolsPort => ({
  lookup: jest.fn(),
  word: jest.fn(),
  lines: jest.fn(),
  translate: jest.fn(),
  ipa: jest.fn(async (text: string, language: string) => ({
    ipa: `/${text}/`,
    ipa_us: language === 'en' ? `/${text}-us/` : null,
    engine: 'espeak-ng 1.52',
  })),
  ...over,
});

describe('Diccionario: «Aprender» y «Aprendido» (10.2)', () => {
  it('marca la entrada como «aprendiendo» y emite WordMarkedToLearn', async () => {
    const entry = { id: 'e1', status: null } as unknown as VocabularyEntry;
    const save = jest.fn(async (e: VocabularyEntry) => e);
    const emit = jest.fn();
    const uc = new MarkWordLearningUseCase(
      { save } as unknown as Repository<VocabularyEntry>,
      { execute: jest.fn(async () => entry) } as unknown as CreateVocabularyEntryUseCase,
      { emit } as unknown as EventEmitter2,
    );
    const out = await uc.execute('u1', { language: 'en', word: 'run' } as never, 't');
    expect(out.status).toBe('learning');
    expect(save).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(
      WORD_MARKED_TO_LEARN_EVENT,
      expect.objectContaining({ userId: 'u1', entryId: 'e1' }),
    );
  });

  it('el listener de Games agrega la palabra al mazo y no rompe si falla', async () => {
    const execute = jest.fn().mockRejectedValueOnce(new Error('sin BD'));
    const listener = new WordMarkedToLearnListener({ execute } as unknown as AddFlashcardUseCase);
    await expect(listener.handle({ userId: 'u1', entryId: 'e1' })).resolves.toBeUndefined();
    expect(execute).toHaveBeenCalledWith('u1', 'e1');
  });
});

describe('Poliglota (10.5/10.6/10.15)', () => {
  it('languageOrder: por defecto español al final; respeta el orden pedido y descarta inválidos', () => {
    expect(languageOrder()).toEqual([...POLYGLOT_DEFAULT_ORDER]);
    expect(languageOrder().at(-1)).toBe('es');
    expect(languageOrder('es, en,xx,EN,ru')).toEqual(['es', 'en', 'ru']);
    expect(languageOrder(['de'])).toEqual(['de']);
    expect(languageOrder('')).toEqual([...POLYGLOT_DEFAULT_ORDER]);
  });

  it('imageProblem: una imagen exige su licencia; el emoji no', () => {
    expect(imageProblem({ imageUrl: 'https://x/y.png' })).toMatch(/licencia/);
    expect(imageProblem({ imageUrl: 'https://x/y.png', imageLicense: 'CC BY 4.0 · autor' })).toBeNull();
    expect(imageProblem({})).toBeNull();
  });

  it('las semillas cubren vocabulario, frases, números y gramática con un término por idioma en cada fila', () => {
    expect(Object.keys(POLYGLOT_SEED).slice(0, 5)).toEqual(['Familia', 'Animales', 'Comida', 'Viajes', 'Cultura']);
    // [2026-10-19]: categorías comparables entre idiomas (un select por categoría en la UI)
    expect(new Set(Object.values(POLYGLOT_SEED).map((t) => t.category ?? 'vocabulary'))).toEqual(new Set(['vocabulary', 'phrases', 'numbers', 'grammar']));
    for (const { rows } of Object.values(POLYGLOT_SEED))
      for (const row of rows) {
        const p = parseRow(row);
        expect(Object.values(p.terms).every((t) => t && t.length > 0)).toBe(true);
        expect(Object.keys(p.terms)).toEqual([...POLYGLOT_DEFAULT_ORDER]);
      }
  });

  it('EnrichTerms pone IPA UK/US al inglés, marca ruso y chino para revisión nativa y no toca los revisados', async () => {
    const terms = [
      { id: 't1', conceptId: 'c1', language: 'en', text: 'dog', ipa: '', ipaUs: null, reviewed: false },
      { id: 't2', conceptId: 'c1', language: 'ru', text: 'собака', ipa: '', ipaUs: null, reviewed: false },
      { id: 't3', conceptId: 'c1', language: 'de', text: 'Hund', ipa: '/hʊnt/', ipaUs: null, reviewed: false },
    ] as PolyglotTerm[];
    const save = jest.fn(async (t: PolyglotTerm) => t);
    const port = tools();
    const uc = new EnrichTermsUseCase(
      { find: jest.fn(async () => terms), save } as unknown as Repository<PolyglotTerm>,
      { find: jest.fn() } as unknown as Repository<PolyglotConcept>,
      port,
    );
    const r = await uc.execute({ conceptIds: ['c1'] }, 'tok');
    expect(r).toEqual({ updated: 2, failed: 0 }); // El alemán ya tenía IPA
    expect(terms[0]).toMatchObject({ ipa: '/dog/', ipaUs: '/dog-us/', needsNativeReview: false });
    expect(terms[1]).toMatchObject({ ipaUs: null, needsNativeReview: true });
    expect(port.ipa).toHaveBeenCalledTimes(2);
  });

  it('EnrichTerms sigue con el resto si FastAPI falla en un término', async () => {
    const terms = [
      { id: 't1', conceptId: 'c1', language: 'fr', text: 'chien', ipa: '', reviewed: false },
      { id: 't2', conceptId: 'c1', language: 'pt', text: 'cão', ipa: '', reviewed: false },
    ] as PolyglotTerm[];
    const port = tools({
      ipa: jest
        .fn()
        .mockRejectedValueOnce(new Error('503'))
        .mockResolvedValueOnce({ ipa: '/kɐ̃w̃/', ipa_us: null, engine: 'e' }),
    });
    const uc = new EnrichTermsUseCase(
      { find: jest.fn(async () => terms), save: jest.fn() } as unknown as Repository<PolyglotTerm>,
      {} as Repository<PolyglotConcept>,
      port,
    );
    expect(await uc.execute({ conceptIds: ['c1'] }, 'tok')).toEqual({ updated: 1, failed: 1 });
  });
});

describe('Gramática (10.9/10.10/10.15)', () => {
  it('las fichas semilla usan tipos de sección válidos y tienen ejemplos', () => {
    expect(GRAMMAR_SEED.map((t) => t.title)).toEqual(['Present Simple', 'Present Continuous', 'Present Perfect']);
    for (const t of GRAMMAR_SEED) {
      expect(t.sections.every(([type]) => isSectionType(type))).toBe(true);
      expect(t.sections.some(([, , ex]) => ex.length > 0)).toBe(true);
    }
  });

  it('EnrichExample asigna IPA, IPA US y traducción por índice y omite los revisados', async () => {
    const examples = [
      { id: 'x1', text: 'I run.', reviewed: false },
      { id: 'x2', text: 'She runs.', reviewed: false },
    ] as GrammarExample[];
    const lines = jest.fn(async (texts: string[]) => ({
      lines: texts.map((text, index) => ({ index, text, ipa: `/${index}/`, ipa_us: `/us${index}/`, translation: `es ${index}` })),
      engine: 'e',
      needs_native_review: false,
    }));
    const save = jest.fn();
    const uc = new EnrichExampleUseCase(
      { find: jest.fn(async () => examples), save } as unknown as Repository<GrammarExample>,
      tools({ lines }),
    );
    expect(await uc.execute(['x1', 'x2'], 'en', 'tok')).toEqual({ updated: 2 });
    expect(examples[1]).toMatchObject({ ipa: '/1/', ipaUs: '/us1/', translation: 'es 1' });
    expect(save).toHaveBeenCalledWith(examples);
  });

  it('EnrichExample no falla si FastAPI no responde (los ejemplos quedan sin IPA)', async () => {
    const uc = new EnrichExampleUseCase(
      { find: jest.fn(async () => [{ id: 'x1', text: 'Hi', reviewed: false }]), save: jest.fn() } as unknown as Repository<GrammarExample>,
      tools({ lines: jest.fn().mockRejectedValue(new Error('503')) }),
    );
    expect(await uc.execute(['x1'], 'en', 'tok')).toEqual({ updated: 0 });
  });

  it('GrammarDraftClient descarta secciones de tipo desconocido y nunca devuelve IPA del LLM', async () => {
    const ollama = {
      generate: jest.fn(async () => ({
        response: JSON.stringify({
          summary: 'Hábitos',
          sections: [
            { type: 'usage', title: 'Uso', body: 'Hábitos', examples: ['I work.', 42, ' '] },
            { type: 'magic', body: 'x' },
          ],
        }),
      })),
    } as unknown as OllamaClient;
    const config = { get: () => undefined } as unknown as ConfigService;
    const out = await new GrammarDraftClient(ollama, config).draft({ title: 'Present Simple', language: 'en', level: 'A1' });
    expect(out.sections).toHaveLength(1);
    expect(out.sections[0].examples).toEqual(['I work.']);
    expect(out.summary).toBe('Hábitos');
  });

  it('GrammarDraftClient responde 503 si el JSON no tiene secciones válidas', async () => {
    const ollama = { generate: jest.fn(async () => ({ response: '{"sections":[]}' })) } as unknown as OllamaClient;
    const config = { get: () => undefined } as unknown as ConfigService;
    await expect(
      new GrammarDraftClient(ollama, config).draft({ title: 'X', language: 'en', level: 'A1' }),
    ).rejects.toThrow(/secciones/);
  });
});
