import { headline, headlineText, textKey } from '../../domain/headline'; // [Dominio]: titular normalizado compartido (DRY)
import { draftContradiction } from '../../domain/source-comparison'; // [Etapa 4]: comparación con otras fuentes
import { createHash } from 'node:crypto'; // [Node.js crypto]: sha256 determinista para la huella de la petición
import {
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CefrLevel } from '../../../../shared/domain/cefr-level.vo';
import {
  Language,
  LANGUAGE_LABEL,
  DEFAULT_VARIANT,
} from '../../../../shared/domain/language.vo';
import {
  LANGUAGE_SKILL_LABEL_ES,
  LanguageSkill,
} from '../../../../shared/domain/language-skill.vo';
import {
  languageMismatch,
  validateCurriculumContent,
} from '../../domain/content/curriculum-content.schema';
import {
  CurriculumGeneration,
  type GenerationFlags,
} from '../../domain/entities/curriculum-generation.entity';
import {
  CURRICULUM_LLM,
  type CurriculumLlm,
  type LlmMetrics,
} from '../../domain/interfaces/curriculum-llm.interface';
import {
  CURRICULUM_REPOSITORY,
  type ICurriculumRepository,
} from '../../domain/interfaces/curriculum.repository.interface';
import { slugify } from '../../domain/slug';
import {
  CURRICULUM_ITEM_KIND_LABEL_ES,
  CurriculumItemKind,
} from '../../domain/value-objects/curriculum-item-kind.vo';
// [Casos de uso de IA del contexto Curriculum]: producen BORRADORES trazables; el autor revisa y guarda | [Patrón]: Pipeline / Chain of Responsibility (existente → caché → LLM) + Port/Adapter + Cache-Aside persistente | [Principio]: SRP + DIP + OCP | [Paradigma]: POO + Funcional
// [Principio de la especificación]: el LLM es un componente especializado, NO la fuente de verdad → primero se reutiliza lo que ya existe; solo lo que falta se genera
// [Garantía]: la salida del LLM pasa por el MISMO esquema Zod que el contenido manual + la regla de coherencia de idioma

// [Versión del prompt]: cambiarla invalida la caché de borradores (evita reutilizar salidas de un prompt antiguo)
export const PROMPT_VERSION = 'content-v4'; // v4: instrucciones de traducción e IPA por variante + limpieza de género (invalida borradores v3 de baja calidad)

// [Forma JSON esperada por tipo]: descripción compacta que va dentro del prompt (espejo de curriculum-content.schema.ts) | `Record<Enum, string>` exhaustivo | [Patrón]: Lookup Table
const SHAPE: Readonly<Record<CurriculumItemKind, string>> = {
  [CurriculumItemKind.VOCABULARY]:
    '{"lemma": palabra en el idioma, "partOfSpeech": categoría en español (sustantivo, verbo…), "gender": género si aplica o "", "translationEs": traducción, "ipa": {"value": "/IPA/", "variant": código BCP-47 del idioma (p. ej. fr-FR), "source": "diccionario de referencia"}, "romanization": solo zh/ru o "", "emoji": un emoji que represente la palabra o "", "examples": [{"text": frase en el idioma, "translationEs": traducción}] (2 ejemplos)}',
  [CurriculumItemKind.GRAMMAR_RULE]:
    '{"title": nombre de la regla, "structure": fórmula corta, "explanationEs": explicación clara en español (3-5 frases), "examples": [{"text": frase en el idioma, "translationEs": traducción}] (3 ejemplos)}',
  [CurriculumItemKind.EXAMPLE]:
    '{"text": una frase natural en el idioma, "translationEs": traducción, "romanization": solo zh/ru o ""}',
  [CurriculumItemKind.TRANSLATION]:
    '{"source": texto corto (1-3 frases) en el idioma, "targetEs": traducción al español, "notes": matices o alternativas en español}',
  [CurriculumItemKind.PRONUNCIATION]:
    '{"text": palabra o frase en el idioma, "ipa": {"value": "/IPA/", "variant": código BCP-47 del idioma, "source": "diccionario de referencia"}, "romanization": solo zh/ru o "", "ruleEs": la regla de pronunciación (fonema, sonido o patrón) explicada en español en 1-2 frases, "examples": [{"text": frase en el idioma donde se oye ese sonido, "translationEs": traducción}] (3 ejemplos)}',
  [CurriculumItemKind.COMMON_ERROR]:
    '{"incorrect": frase con el error típico de hispanohablantes, "correct": la forma correcta, "explanationEs": por qué es un error, en español}',
  [CurriculumItemKind.EXERCISE]:
    '{"prompt": enunciado (en el idioma; si es de completar, marca el hueco con ___), "type": "multiple_choice", "options": [4 opciones en el idioma], "answerKey": [la opción correcta, copiada EXACTAMENTE de options], "explanationEs": explicación en español}',
  [CurriculumItemKind.RUBRIC]:
    '{"title": nombre de la rúbrica, "criteria": [{"name": criterio, "descriptorEs": qué se evalúa, "maxPoints": entero 1-10, "bands": [{"points": entero, "descriptorEs": descripción}]}] (3-4 criterios)}',
};

// [Qué es un "tema" según el tipo]: orienta a la IA para que las sugerencias encajen con lo que se va a crear | [Patrón]: Lookup Table
const TOPIC_HINT: Readonly<Record<CurriculumItemKind, string>> = {
  [CurriculumItemKind.VOCABULARY]:
    'campos léxicos, p. ej. "La familia", "La ropa"',
  [CurriculumItemKind.GRAMMAR_RULE]:
    'estructuras gramaticales, p. ej. "Presente simple", "Artículos definidos"',
  [CurriculumItemKind.EXAMPLE]:
    'situaciones comunicativas, p. ej. "Pedir en un restaurante", "Presentarse"',
  [CurriculumItemKind.TRANSLATION]:
    'situaciones o textos cortos, p. ej. "Correo formal", "Indicaciones en la calle"',
  [CurriculumItemKind.PRONUNCIATION]:
    'sonidos o grupos de palabras, p. ej. "Vocales nasales", "Números"',
  [CurriculumItemKind.COMMON_ERROR]:
    'errores típicos de hispanohablantes, p. ej. "Falsos amigos", "Uso de preposiciones"',
  [CurriculumItemKind.EXERCISE]:
    'contenidos evaluables, p. ej. "Verbos regulares en presente", "Vocabulario de la casa"',
  [CurriculumItemKind.RUBRIC]:
    'tareas de expresión, p. ej. "Descripción de una persona", "Correo informal"',
};

// `export interface` (TS): entrada común de las consultas (la valida el DTO en presentación)
export interface DraftTarget {
  language: Language;
  level: CefrLevel;
  skill: LanguageSkill;
}

// [Estrategia usada]: para la UI y el registro → deja claro si se gastó cómputo de LLM o no
export type DraftStrategy = 'existing' | 'cache' | 'llm';

// [Borrador individual]: un elemento del lote con su registro trazable
export interface DraftItem {
  content: Record<string, unknown>;
  generationId?: string;
}

// `export interface` (TS): respuesta del caso de uso (lo que ve el autor antes de guardar)
export interface DraftResult {
  strategy: DraftStrategy;
  llmRequired: boolean; // LLM_REQUIRED de la especificación
  content: Record<string, unknown>; // Primer elemento (compatibilidad con clientes de un solo elemento)
  drafts: DraftItem[]; // [Lote]: todos los elementos generados (1…MAX_BATCH)
  generationId?: string; // Id del registro trazable (cache/llm) → se enlaza al recurso al guardar
  existingItemId?: string; // strategy=existing: el recurso que ya cubre este tema
  trace?: CurriculumGeneration; // Traza completa (modelo, tokens, latencia…)
}

export const MAX_BATCH = 10; // Máximo de elementos por generación (límite de contexto del modelo local)
const ROMANIZED = new Set<Language>([Language.ZH, Language.RU]); // Solo estos idiomas llevan romanización
const GENDERED = new Set<Language>([
  Language.ES,
  Language.FR,
  Language.DE,
  Language.PT,
  Language.RU,
]); // Idiomas con género gramatical (en y zh no)

// [sameAsWord]: la traducción repite la palabra original (p. ej. hoodie → "hoodie") → posible error del modelo o préstamo | [Paradigma]: Funcional (pura)
export const sameAsWord = (c: Record<string, unknown>): boolean =>
  typeof c.lemma === 'string' &&
  typeof c.translationEs === 'string' &&
  slugify(c.lemma) !== '' &&
  slugify(c.lemma) === slugify(c.translationEs);

// [requestHash]: huella normalizada (minúsculas, sin tildes vía slug) → "La Familia" y "la familia" son la misma petición | [Paradigma]: Funcional (pura)
export function requestHash(
  input: DraftTarget & {
    kind: CurriculumItemKind;
    topic: string;
    count?: number;
  },
): string {
  return createHash('sha256')
    .update(
      [
        input.kind,
        input.language,
        input.level,
        input.skill,
        slugify(input.topic),
        input.count ?? 1,
        PROMPT_VERSION,
      ].join('|'),
    )
    .digest('hex');
}

// [cleanDraft]: correcciones deterministas SIN inventar contenido | [Paradigma]: Funcional
// - variante IPA ausente → la del idioma · - romanización solo en zh/ru (los modelos pequeños la inventan para otros idiomas)
function cleanDraft(language: Language, raw: unknown): Record<string, unknown> {
  const draft = (
    raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {}
  ) as Record<string, unknown>;
  const ipa = draft.ipa as { value?: string; variant?: string } | undefined;
  if (ipa?.value && !ipa.variant) ipa.variant = DEFAULT_VARIANT[language];
  // [answerKey · 2026-10-20]: los modelos pequeños devuelven a veces la respuesta como texto ("A") en vez de lista (["A"]) → se envuelve (no se inventa nada)
  if (typeof draft.answerKey === 'string') draft.answerKey = [draft.answerKey];
  // [Chino · 2026-10-20]: el modelo pone el pinyin en el campo principal y los caracteres en `romanization` → se intercambian si es así
  if (language === Language.ZH) swapPinyin(draft);
  if (!GENDERED.has(language)) delete draft.gender; // [Determinista]: el inglés y el chino no tienen género gramatical (evita "skirt · femenino")
  if (!ROMANIZED.has(language)) {
    delete draft.romanization; // `delete` (JS): quita la propiedad del objeto copiado
    // `Object.entries/fromEntries` (ES2019): cada ejemplo sin su romanización
    if (Array.isArray(draft.examples))
      draft.examples = (draft.examples as Array<Record<string, unknown>>).map(
        (e) =>
          Object.fromEntries(
            Object.entries(e).filter(([k]) => k !== 'romanization'),
          ),
      );
  }
  return draft;
}

// [swapPinyin]: campo de texto sin caracteres chinos + romanización CON caracteres → estaban al revés | también en los ejemplos | Funcional (muta la copia)
const HAN_RE = /\p{Script=Han}/u;
function swapPinyin(d: Record<string, unknown>): void {
  for (const field of ['lemma', 'text']) {
    const main = d[field];
    const rom = d.romanization;
    if (typeof main === 'string' && typeof rom === 'string' && !HAN_RE.test(main) && HAN_RE.test(rom)) {
      d[field] = rom;
      d.romanization = main;
    }
  }
  if (Array.isArray(d.examples)) (d.examples as Array<Record<string, unknown>>).forEach((e) => e && typeof e === 'object' && swapPinyin(e));
}

// [Banderas deterministas]: reglas explícitas, sin LLM | [Patrón]: Specification | lo generado nunca se presenta como verificado
export function generationFlags(
  kind: CurriculumItemKind,
  content: Record<string, unknown>,
): GenerationFlags {
  const reasons = [
    'Contenido generado por IA: requiere revisión humana antes de publicarse.',
  ];
  if ((content.ipa as { value?: string } | undefined)?.value)
    reasons.push(
      'IPA propuesta por la IA sin diccionario verificado: contrástala con una fuente especializada.',
    );
  if (kind === CurriculumItemKind.VOCABULARY && sameAsWord(content))
    reasons.push(
      'La traducción es igual a la palabra original: confirma si es un préstamo aceptado o tradúcela.',
    );
  if (kind === CurriculumItemKind.EXERCISE)
    reasons.push('Comprueba que la respuesta correcta sea única e inequívoca.');
  if (
    kind === CurriculumItemKind.TRANSLATION ||
    kind === CurriculumItemKind.COMMON_ERROR
  )
    reasons.push(
      'Verifica la traducción/explicación con un hablante competente.',
    );
  // `contradiction: 'not_checked'`: hubo una sola fuente (el LLM) → no se afirma ausencia de contradicciones
  return {
    requiresReview: true,
    reasons,
    contradiction: 'not_checked',
    reusable: true,
    llmRequired: true,
  };
}

@Injectable()
export class GenerateContentDraftQuery {
  // `@Inject(TOKEN)` (NestJS): recibe los Adapters por sus puertos → el caso de uso no conoce Ollama ni TypeORM concreto | [Principio]: DIP
  constructor(
    @Inject(CURRICULUM_LLM) private readonly llm: CurriculumLlm,
    @Inject(CURRICULUM_REPOSITORY)
    private readonly items: ICurriculumRepository,
    @InjectRepository(CurriculumGeneration)
    private readonly generations: Repository<CurriculumGeneration>,
  ) {}

  // `force`: el autor pidió explícitamente una versión nueva (salta existente y caché) · `count`: cuántos elementos distintos crear (1…MAX_BATCH)
  async execute(
    input: DraftTarget & {
      kind: CurriculumItemKind;
      topic: string;
      force?: boolean;
      count?: number;
      exclude?: string[];
      guidance?: string; // [Etapa 5]: indicación extra (p. ej. formato de una certificación) que se añade al prompt
    },
    actorId: string,
  ): Promise<DraftResult> {
    const count = Math.min(Math.max(input.count ?? 1, 1), MAX_BATCH); // `Math.min/max`: acota el tamaño del lote
    // [Exclusión]: lo que el autor ya tiene en el formulario + lo ya guardado de este tema → la IA propone elementos NUEVOS (sin repetir entre lotes)
    const existingInTopic = await this.items.search({
      language: input.language,
      kind: input.kind,
      topic: input.topic.trim(),
      page: 1,
      limit: 100,
    });
    const exclude = [
      ...new Set(
        [
          ...(input.exclude ?? []),
          ...existingInTopic.data.map((i) => headlineText(i.content)),
        ].filter(Boolean),
      ),
    ];
    const excluded = new Set(exclude.map((t) => textKey(t))); // Comparación normalizada (sin tildes ni mayúsculas)
    // ── 1) Contenido existente (determinista, coste ~0): mismo idioma + tipo + tema ya creado → reutilizar, no duplicar (solo al pedir UNO)
    if (!input.force && count === 1 && !exclude.length) {
      const existing = await this.items.findByNaturalKey(
        input.language,
        input.kind,
        slugify(input.topic),
      );
      if (existing)
        return {
          strategy: 'existing',
          llmRequired: false,
          content: existing.content,
          drafts: [{ content: existing.content }],
          existingItemId: existing.id,
        };
    }

    // ── 2) Caché persistente: petición idéntica (incluida la cantidad) ya generada → mismo lote sin volver a llamar al LLM
    const hash = requestHash({ ...input, count });
    if (!input.force && !exclude.length) {
      // ponytail: toma los `count` registros más recientes del hash; un lote parcial podría mezclarse con uno anterior (aceptable: todos son válidos)
      const cached = await this.generations.find({
        where: { requestHash: hash },
        order: { createdAt: 'DESC' },
        take: count,
      });
      // [Revalidación]: la caché también pasa la regla de idioma → un borrador antiguo mal generado no se reutiliza
      if (
        cached.length === count &&
        cached.every((g) => !languageMismatch(input.language, g.content))
      ) {
        return {
          strategy: 'cache',
          llmRequired: false,
          content: cached[0].content,
          drafts: cached.map((g) => ({
            content: g.content,
            generationId: g.id,
          })),
          generationId: cached[0].id,
          trace: cached[0],
        };
      }
    }

    // ── 3) LLM: solo lo que falta · hasta 3 intentos que ACUMULAN los válidos hasta llegar a la cantidad pedida (antes se quedaba corto)
    // [2026-10-20]: cada reintento pide solo los que faltan, con más temperatura (variedad) y la lista de lo repetido → menos «solo propuso elementos que ya existen»
    const valid: Record<string, unknown>[] = [];
    let problems: string[] = [];
    let metrics: LlmMetrics | null = null;
    let repeated: string[] = [];
    const seen = new Set<string>(excluded); // [Sin duplicados]: ni dentro del lote ni con lo ya creado | `Set` (ES2015)
    const avoid = [...exclude];
    for (let attempt = 0; attempt < 3 && valid.length < count; attempt++) {
      const missing = count - valid.length;
      const res = await this.llm.generateJson(
        this.prompt(input, missing, problems, avoid, repeated),
        Math.min(350 + 450 * missing, 3500),
        [0.3, 0.6, 0.85][attempt],
      );
      metrics = res.metrics;
      const data = res.data as { items?: unknown } | null;
      // Un elemento → objeto; varios → {"items": [...]} (se toleran ambas formas)
      const raws: unknown[] = Array.isArray(data?.items) ? data.items : [data];
      problems = [];
      repeated = [];
      for (const raw of raws.slice(0, missing + 2)) {
        if (valid.length >= count) break;
        const result = validateCurriculumContent(
          input.kind,
          cleanDraft(input.language, raw),
        ); // [Validación de dominio]: mismo esquema que el contenido manual
        if (!result.ok) {
          problems.push(result.errors.join('; '));
          continue;
        }
        const mismatch = languageMismatch(input.language, result.content); // [Coherencia de idioma]: regla determinista
        if (mismatch) {
          problems.push(mismatch);
          continue;
        }
        const h = headline(result.content);
        if (seen.has(h)) {
          repeated.push(headlineText(result.content));
          continue;
        }
        seen.add(h);
        avoid.push(headlineText(result.content));
        valid.push(result.content);
      }
    }
    if (!valid.length && metrics && !problems.length) {
      throw new UnprocessableEntityException(
        'La IA solo propuso elementos que ya existen en este tema. Prueba con un tema más amplio o escribe los nuevos a mano.',
      );
    }
    if (!valid.length || !metrics) {
      throw new UnprocessableEntityException(
        `La IA devolvió un contenido no válido (${problems.slice(0, 3).join(' | ')}). Intenta de nuevo o complétalo a mano.`,
      );
    }

    // [Etapa 4 · Contradicciones]: cada borrador se compara con lo ya guardado del mismo idioma y tipo (otras fuentes) → bandera en la traza
    const stored = await this.items.listForComparison(
      input.language,
      input.kind,
    );
    // [Registro trazable]: un registro por elemento válido → reutilizable y auditable
    const m = metrics;
    const saved = await this.generations.save(
      valid.map((content) =>
        this.generations.create({
          requestHash: hash,
          kind: input.kind,
          language: input.language,
          level: input.level,
          skill: input.skill,
          topic: input.topic.trim(),
          content,
          ...m,
          promptVersion: PROMPT_VERSION,
          flags: {
            ...generationFlags(input.kind, content),
            contradiction: draftContradiction(input.kind, content, stored), // not_checked | none | detected
          },
          createdBy: actorId,
        }),
      ),
    );
    return {
      strategy: 'llm',
      llmRequired: true,
      content: saved[0].content,
      drafts: saved.map((g) => ({ content: g.content, generationId: g.id })),
      generationId: saved[0].id,
      trace: saved[0],
    };
  }

  // [prompt]: instrucciones explícitas de idioma + forma JSON; en el reintento incluye por qué se rechazó la respuesta anterior | [Principio]: SRP
  private prompt(
    input: DraftTarget & {
      kind: CurriculumItemKind;
      topic: string;
      guidance?: string;
    },
    count: number,
    problems: string[],
    exclude: string[] = [],
    repeated: string[] = [],
  ): string {
    const lang = LANGUAGE_LABEL[input.language];
    const kindLabel = CURRICULUM_ITEM_KIND_LABEL_ES[input.kind];
    const skill = LANGUAGE_SKILL_LABEL_ES[input.skill];
    return [
      `Eres un profesor experto de ${lang} para hispanohablantes.`,
      count === 1
        ? `Crea UN recurso ORIGINAL de tipo "${kindLabel}" para nivel MCER ${input.level}, habilidad "${skill}", tema "${input.topic}".`
        : `Crea ${count} recursos ORIGINALES y DISTINTOS entre sí de tipo "${kindLabel}" para nivel MCER ${input.level}, habilidad "${skill}", tema "${input.topic}".`,
      `IDIOMA OBLIGATORIO: las palabras, frases y opciones del recurso se escriben en ${lang} (código ${input.language}), NUNCA en español. Solo los campos que terminan en "Es" (traducciones y explicaciones) van en español.`,
      // [Calidad de traducción e IPA]: instrucciones explícitas para modelos pequeños (errores observados: sweater → "gorro", hoodie → "hoodie", IPA americana con variante en-GB)
      'translationEs: la traducción española MÁS COMÚN y exacta de la palabra (no una palabra parecida ni otra prenda u objeto); no copies la palabra original salvo que en español se use igual (p. ej. "hotel").',
      `IPA: transcripción fonética de la variante ${DEFAULT_VARIANT[input.language]}${input.language === Language.EN ? ' (inglés británico: NO rótico, p. ej. "water" /ˈwɔːtə/, "sweater" /ˈswetə/)' : ''}, entre barras.`,
      GENDERED.has(input.language)
        ? 'gender: el género gramatical del sustantivo en el idioma objetivo, o "" si no aplica.'
        : 'gender: siempre "" (este idioma no tiene género gramatical).',
      ROMANIZED.has(input.language) ? '' : 'No incluyas romanización.',
      'No copies material protegido ni preguntas de exámenes oficiales.',
      input.guidance ?? '', // [Etapa 5]: formato de la certificación + originalidad
      exclude.length
        ? `NO repitas estos elementos que ya existen: ${exclude.slice(0, 80).join(', ')}.`
        : '',
      problems.length
        ? `Tu respuesta anterior fue rechazada por: ${problems.slice(0, 3).join(' | ')}. Corrígelo.`
        : '',
      repeated.length
        ? `Repetiste elementos que YA EXISTEN (${repeated.slice(0, 10).join(', ')}): propón otros DIFERENTES del mismo tema, también menos frecuentes o más específicos.`
        : '',
      input.language === Language.ZH
        ? 'Chino: el campo principal (lemma/text/source) y los ejemplos van en caracteres chinos (汉字); el pinyin con tonos va SOLO en "romanization".'
        : '',
      input.language === Language.RU
        ? 'Ruso: el campo principal y los ejemplos van en alfabeto cirílico; la transliteración latina va SOLO en "romanization".'
        : '',
      input.kind === CurriculumItemKind.EXERCISE
        ? '"answerKey" es SIEMPRE una lista (array) aunque haya una sola respuesta, p. ej. ["la bonne réponse"].'
        : '',
      count === 1
        ? `Responde SOLO con un objeto JSON con esta forma exacta: ${SHAPE[input.kind]}`
        : `Responde SOLO con JSON: {"items": [${count} objetos, cada uno con esta forma exacta: ${SHAPE[input.kind]}]}`,
    ]
      .filter(Boolean) // Quita las líneas vacías condicionales
      .join('\n');
  }
}

@Injectable()
export class SuggestTopicsQuery {
  constructor(
    @Inject(CURRICULUM_LLM) private readonly llm: CurriculumLlm,
    @Inject(CURRICULUM_REPOSITORY)
    private readonly items: ICurriculumRepository,
  ) {}

  // [Sugerencia de temas]: el autor ya ve el temario existente en la lista → el botón pide a la IA temas NUEVOS (sin repetir el temario) acordes al tipo, idioma y nivel
  async execute(
    input: DraftTarget & { kind?: CurriculumItemKind },
  ): Promise<{ topics: string[]; llmRequired: boolean }> {
    const catalog = (
      await this.items.searchTopics({
        language: input.language,
        level: input.level,
        skill: input.skill,
        kind: input.kind,
        limit: 50,
      })
    ).map((t) => t.name);
    const lang = LANGUAGE_LABEL[input.language];
    const kind = input.kind
      ? ` para recursos de tipo "${CURRICULUM_ITEM_KIND_LABEL_ES[input.kind]}" (${TOPIC_HINT[input.kind]})`
      : '';
    const prompt = [
      `Eres coordinador académico de ${lang} (MCER) para hispanohablantes.`,
      `Propón 8 temas del temario de ${lang} nivel ${input.level}, habilidad "${LANGUAGE_SKILL_LABEL_ES[input.skill]}"${kind}.`,
      catalog.length
        ? `No repitas estos temas que ya existen: ${catalog.slice(0, 30).join('; ')}.`
        : '',
      'Cada tema: nombre corto (2-6 palabras), en español, sin numeración.',
      'Responde SOLO con JSON: {"topics": ["tema 1", "tema 2", ...]}',
    ]
      .filter(Boolean)
      .join('\n');

    const { data } = await this.llm.generateJson(prompt, 300);
    const raw = data as { topics?: unknown };
    const seen = new Set(catalog.map((t) => slugify(t))); // Temario + ya añadidos (comparación normalizada)
    // `Array.isArray` + type guard (TS) + `Set` (ES2015): strings útiles, únicos y NUEVOS; máx. 10
    const topics = Array.isArray(raw?.topics)
      ? raw.topics
          .filter((t): t is string => typeof t === 'string')
          .map((t) => t.trim())
          .filter(
            (t) =>
              t.length >= 2 &&
              t.length <= 160 &&
              !seen.has(slugify(t)) &&
              Boolean(seen.add(slugify(t))),
          )
          .slice(0, 10)
      : [];
    if (!topics.length)
      throw new UnprocessableEntityException(
        'La IA no devolvió temas nuevos. Intenta de nuevo.',
      );
    return { topics, llmRequired: true };
  }
}
