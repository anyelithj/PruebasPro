import { languageMismatch, validateCurriculumContent } from '../../../src/modules/curriculum/domain/content/curriculum-content.schema';
import { GenerateContentDraftQuery, generationFlags, requestHash, SuggestTopicsQuery } from '../../../src/modules/curriculum/application/queries/ai-draft.queries';
import type { CurriculumLlm, LlmMetrics } from '../../../src/modules/curriculum/domain/interfaces/curriculum-llm.interface';
import { CurriculumItemKind } from '../../../src/modules/curriculum/domain/value-objects/curriculum-item-kind.vo';
import { CefrLevel } from '../../../src/shared/domain/cefr-level.vo';
import { Language } from '../../../src/shared/domain/language.vo';
import { LanguageSkill } from '../../../src/shared/domain/language-skill.vo';

// [Suite IA curricular]: orden existente → caché → LLM, coherencia de idioma, banderas y trazas | [Patrón]: Test Double (Stub/Spy) sin red ni BD

const METRICS: LlmMetrics = { model: 'qwen2.5:3b', modelDigest: 'd1', quantization: 'Q4_K_M', parameterSize: '3.1B', promptTokens: 120, outputTokens: 80, latencyMs: 900, loadMs: 300, ramBytes: 2_000_000_000, vramBytes: 0 };
const llm = (data: unknown): CurriculumLlm & { generateJson: jest.Mock } => ({ generateJson: jest.fn().mockResolvedValue({ data, metrics: METRICS }) });
// [Stubs de repositorios]: por defecto no existe nada (ni recurso ni caché)
const itemsRepo = (overrides: Record<string, unknown> = {}) => ({ findByNaturalKey: jest.fn().mockResolvedValue(null), searchTopics: jest.fn().mockResolvedValue([]), search: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 100 }), listForComparison: jest.fn().mockResolvedValue([]), ...overrides });
// `save` recibe un array (un registro por elemento del lote) | `find` = caché
const generationsRepo = (cached: unknown = null) => ({ find: jest.fn().mockResolvedValue(cached ? [cached] : []), create: jest.fn((x) => x), save: jest.fn(async (xs: Array<Record<string, any>>) => xs.map((x, i) => ({ id: `g${i + 1}`, ...x }))) });

const target = { language: Language.FR, level: CefrLevel.A2, skill: LanguageSkill.VOCABULARY };
const req = { ...target, kind: CurriculumItemKind.VOCABULARY, topic: 'La casa' };
const vocab = { lemma: 'eau', translationEs: 'agua', ipa: { value: '/o/' }, examples: [] };
const make = (l: CurriculumLlm, items = itemsRepo(), gens = generationsRepo()) => new GenerateContentDraftQuery(l, items as never, gens as never);

describe('languageMismatch', () => {
  it('detecta IPA de otro idioma y acepta la del propio', () => {
    expect(languageMismatch(Language.FR, { ipa: { value: '/o/', variant: 'en-GB' } })).toMatch(/no corresponde/);
    expect(languageMismatch(Language.FR, { ipa: { value: '/o/', variant: 'fr-FR' } })).toBeNull();
  });
});

describe('GenerateContentDraftQuery — orden existente → caché → LLM', () => {
  it('1) reutiliza un recurso existente sin llamar al LLM', async () => {
    const l = llm(vocab);
    const r = await make(l, itemsRepo({ findByNaturalKey: jest.fn().mockResolvedValue({ id: 'i9', content: vocab }) })).execute(req, 'u1');
    expect(r).toMatchObject({ strategy: 'existing', llmRequired: false, existingItemId: 'i9' });
    expect(l.generateJson).not.toHaveBeenCalled();
  });

  it('2) reutiliza un borrador en caché sin llamar al LLM', async () => {
    const l = llm(vocab);
    const r = await make(l, itemsRepo(), generationsRepo({ id: 'g0', content: vocab })).execute(req, 'u1');
    expect(r).toMatchObject({ strategy: 'cache', llmRequired: false, generationId: 'g0' });
    expect(l.generateJson).not.toHaveBeenCalled();
  });

  it('3) solo genera lo que falta y guarda la traza completa', async () => {
    const gens = generationsRepo();
    const r = await make(llm(vocab), itemsRepo(), gens).execute(req, 'u1');
    expect(r.strategy).toBe('llm');
    const saved = gens.save.mock.calls[0][0][0];
    expect(saved).toMatchObject({ model: 'qwen2.5:3b', quantization: 'Q4_K_M', promptTokens: 120, outputTokens: 80, latencyMs: 900, createdBy: 'u1' });
    expect(saved.flags).toMatchObject({ requiresReview: true, llmRequired: true, contradiction: 'not_checked' });
    expect((saved.content.ipa as { variant: string }).variant).toBe('fr-FR'); // Variante completada de forma determinista
  });

  it('force=true salta existente y caché', async () => {
    const l = llm(vocab);
    await make(l, itemsRepo({ findByNaturalKey: jest.fn().mockResolvedValue({ id: 'i9', content: vocab }) }), generationsRepo({ id: 'g0', content: vocab })).execute({ ...req, force: true }, 'u1');
    expect(l.generateJson).toHaveBeenCalledTimes(1);
  });

  it('rechaza contenido de otro idioma (evita el "revuelto")', async () => {
    const english = { ...vocab, lemma: 'water', ipa: { value: '/ˈwɔːtə/', variant: 'en-GB' } };
    await expect(make(llm(english)).execute(req, 'u1')).rejects.toThrow(/no corresponde/);
  });
});

describe('requestHash y banderas', () => {
  it('peticiones equivalentes producen la misma huella', () => {
    expect(requestHash({ ...req, topic: 'La Casa' })).toBe(requestHash({ ...req, topic: 'la casa' }));
    expect(requestHash({ ...req, topic: 'La casa' })).not.toBe(requestHash({ ...req, level: CefrLevel.B1 }));
  });

  it('marca la IPA generada como pendiente de verificación', () => {
    expect(generationFlags(CurriculumItemKind.VOCABULARY, vocab).reasons.join(' ')).toMatch(/IPA/);
  });
});

describe('SuggestTopicsQuery', () => {
  it('devuelve solo temas NUEVOS (sin repetir el temario ni duplicados)', async () => {
    const r = await new SuggestTopicsQuery(llm({ topics: ['La familia', 'la familia', 3, 'La casa'] }), itemsRepo({ searchTopics: jest.fn().mockResolvedValue([{ name: 'La Casa' }]) }) as never).execute(target);
    expect(r.topics).toEqual(['La familia']);
  });
});

describe('Lotes y coherencia de idioma', () => {
  const en = { ...target, language: Language.EN, kind: CurriculumItemKind.EXAMPLE, topic: 'Pedir comida' };

  it('genera N elementos distintos y guarda un registro por elemento', async () => {
    const items = [
      { text: 'Could I see the menu, please?', translationEs: '¿Podría ver el menú, por favor?' },
      { text: 'Could I see the menu, please?', translationEs: 'duplicado' },
      { text: 'I would like a glass of water.', translationEs: 'Quisiera un vaso de agua.' },
    ];
    const gens = generationsRepo();
    const r = await make(llm({ items }), itemsRepo(), gens).execute({ ...en, count: 3 }, 'u1');
    expect(r.drafts).toHaveLength(2); // El duplicado se descarta
    expect(gens.save.mock.calls[0][0]).toHaveLength(2);
  });

  it('rechaza una frase en español para un recurso de inglés y reintenta (hasta 3 intentos)', async () => {
    const l = llm({ text: '¿Podrías decirme qué quieres comer?', translationEs: '¿Podrías decirme qué quieres comer?', romanization: 'ko-pu-ri' });
    await expect(make(l).execute(en, 'u1')).rejects.toThrow(/español/);
    expect(l.generateJson).toHaveBeenCalledTimes(3); // [2026-10-20]: hasta 3 intentos que acumulan válidos hasta completar la cantidad
  });

  it('quita la romanización inventada en idiomas que no la usan', async () => {
    const r = await make(llm({ text: 'Where is the station?', translationEs: '¿Dónde está la estación?', romanization: 'ue-ris' })).execute(en, 'u1');
    expect(r.content.romanization).toBeUndefined();
  });

  it('no repite elementos ya guardados del tema y los pasa en el prompt', async () => {
    const l = llm({ items: [{ text: 'Could I see the menu, please?', translationEs: 'x x x x' }, { text: 'The bill, please.', translationEs: 'La cuenta, por favor.' }] });
    const repo = itemsRepo({ search: jest.fn().mockResolvedValue({ data: [{ content: { text: 'Could I see the menu, please?' } }], total: 1, page: 1, limit: 100 }) });
    const r = await make(l, repo).execute({ ...en, count: 2 }, 'u1');
    expect(r.drafts.map((d) => d.content.text)).toEqual(['The bill, please.']);
    expect(l.generateJson.mock.calls[0][0]).toMatch(/NO repitas.*Could I see the menu/);
  });

  it('quita el género en inglés y marca la traducción igual a la palabra', async () => {
    const vocabEn = { ...en, kind: CurriculumItemKind.VOCABULARY, topic: 'La ropa' };
    const gens = generationsRepo();
    const r = await make(llm({ lemma: 'hoodie', translationEs: 'Hoodie', gender: 'femenino', examples: [] }), itemsRepo(), gens).execute(vocabEn, 'u1');
    expect(r.content.gender).toBeUndefined();
    expect(gens.save.mock.calls[0][0][0].flags.reasons.join(' ')).toMatch(/igual a la palabra/);
  });

  it('exige alfabeto cirílico en ruso', () => {
    expect(languageMismatch(Language.RU, { text: 'privet kak dela', translationEs: 'hola' })).toMatch(/cirílico/);
    expect(languageMismatch(Language.RU, { text: 'Привет', translationEs: 'hola' })).toBeNull();
  });
});

describe('Vocabulario con apoyo visual (emoji e imagen)', () => {
  const base = { lemma: 'apple', translationEs: 'manzana' };
  it('acepta emoji e imagen WebP en base64', () => {
    expect(validateCurriculumContent(CurriculumItemKind.VOCABULARY, { ...base, emoji: '🍎', image: 'data:image/webp;base64,UklGRg==' }).ok).toBe(true);
  });
  it('rechaza imágenes que no son data URL de imagen', () => {
    expect(validateCurriculumContent(CurriculumItemKind.VOCABULARY, { ...base, image: 'https://evil.example/x.svg' }).ok).toBe(false);
    expect(validateCurriculumContent(CurriculumItemKind.VOCABULARY, { ...base, image: 'data:image/svg+xml;base64,PHN2Zz4=' }).ok).toBe(false);
  });
});
