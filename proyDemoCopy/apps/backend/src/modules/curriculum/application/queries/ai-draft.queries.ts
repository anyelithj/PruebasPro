import { curatedGrammar } from '../../domain/content/grammar-templates'; // [2026-11-13 · Caso D]: reglas verificadas (sin LLM)
import { contentIpa } from '../../../../shared/domain/article-ipa';
import { headline, headlineText, textKey } from '../../domain/headline'; // [Dominio]: titular normalizado compartido (DRY)
import { draftContradiction } from '../../domain/source-comparison'; // [Etapa 4]: comparación con otras fuentes
import { createHash } from 'node:crypto'; // [Node.js crypto]: sha256 determinista para la huella de la petición
import {
  Inject,
  Injectable,
  Optional,
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
  applyGrammar,
  needsGrammar,
  withArticle,
} from '../../domain/content/vocabulary-grammar'; // [2026-11-06]: artículo (también deducido del género)
import { articleInLemma } from '../../domain/content/vocabulary-article';
import { NounGrammarService } from '../../../../shared/noun-grammar/noun-grammar.service';
import {
  CURRICULUM_ITEM_KIND_LABEL_ES,
  CurriculumItemKind,
} from '../../domain/value-objects/curriculum-item-kind.vo';
// [Casos de uso de IA del contexto Curriculum]: producen BORRADORES trazables; el autor revisa y guarda | [Patrón]: Pipeline / Chain of Responsibility (existente → caché → LLM) + Port/Adapter + Cache-Aside persistente | [Principio]: SRP + DIP + OCP | [Paradigma]: POO + Funcional
// [Principio de la especificación]: el LLM es un componente especializado, NO la fuente de verdad → primero se reutiliza lo que ya existe; solo lo que falta se genera
// [Garantía]: la salida del LLM pasa por el MISMO esquema Zod que el contenido manual + la regla de coherencia de idioma

// [Versión del prompt]: cambiarla invalida la caché de borradores (evita reutilizar salidas de un prompt antiguo)
export const PROMPT_VERSION = 'content-v6'; // v6 (2026-11-05): vocabulario con artículo, plural y clasificador por idioma
// // v5 (2026-10-24): reglas gramaticales robustas + ficha de fonema (cuándo/cómo/palabras/frases) → invalida los borradores v4

// [Forma JSON esperada por tipo]: descripción compacta que va dentro del prompt (espejo de curriculum-content.schema.ts) | `Record<Enum, string>` exhaustivo | [Patrón]: Lookup Table
const SHAPE: Readonly<Record<CurriculumItemKind, string>> = {
  [CurriculumItemKind.VOCABULARY]:
    '{"lemma": palabra en el idioma (sustantivo de/fr/pt/es: SIEMPRE con su artículo definido delante, p. ej. "der Tisch", "l\'école"), "partOfSpeech": categoría en español (sustantivo, verbo…), "gender": género si aplica o "", "article": artículo definido del sustantivo o "", "plural": plural con su artículo (p. ej. "die Tische") o "", "classifier": solo zh, clasificador con numeral (p. ej. "一本书") o "", "translationEs": traducción, "ipa": {"value": "/IPA/", "variant": código BCP-47 del idioma (p. ej. fr-FR), "source": "diccionario de referencia"}, "romanization": solo zh/ru o "", "emoji": un emoji que represente la palabra o "", "examples": [{"text": frase en el idioma, "translationEs": traducción}] (2 ejemplos)}',
  // [2026-10-24]: tipos explícitos ("texto", lista de OBJETOS) → los modelos pequeños devolvían explanationEs como lista o los ejemplos como cadenas sueltas y el esquema los rechazaba
  [CurriculumItemKind.GRAMMAR_RULE]:
    '{"title": nombre corto de la regla (texto), "structure": fórmula corta (texto, p. ej. "Sujeto + have/has + participio"), "explanationEs": explicación clara en español en UN solo texto de 3-5 frases (cuándo y cómo se usa), "examples": [{"text": frase en el idioma, "translationEs": su traducción al español}] (3 objetos)}',
  [CurriculumItemKind.EXAMPLE]:
    '{"text": una frase natural en el idioma, "translationEs": traducción, "romanization": solo zh/ru o ""}',
  [CurriculumItemKind.TRANSLATION]:
    '{"source": texto corto (1-3 frases) en el idioma, "targetEs": traducción al español, "notes": matices o alternativas en español}',
  // [Ficha de fonema · 2026-10-24]: para un sonido como /ɒ/ → cuándo se usa, cómo se pronuncia, palabras y frases donde se oye (la vista añade el audio de cada una)
  [CurriculumItemKind.PRONUNCIATION]:
    '{"text": palabra CLAVE en el idioma donde se oye claramente el sonido, "phoneme": símbolo IPA del sonido practicado SIN barras (p. ej. "ɒ"), "ipa": {"value": "/IPA de la palabra clave/", "variant": código BCP-47 del idioma, "source": "diccionario de referencia"}, "romanization": solo zh/ru o "", "ruleEs": CUÁNDO se usa este sonido: qué letras o combinaciones lo producen y en qué posiciones, en español (2-3 frases), "articulationEs": CÓMO se pronuncia: labios, lengua y mandíbula comparados con un sonido del español (1-2 frases), "words": [{"text": palabra en el idioma que contiene el sonido, "ipa": "/IPA/", "translationEs": traducción}] (5 objetos), "examples": [{"text": frase en el idioma con varias palabras que tienen el sonido, "translationEs": traducción}] (3 objetos)}',
  [CurriculumItemKind.COMMON_ERROR]:
    '{"incorrect": frase con el error típico de hispanohablantes, "correct": la forma correcta, "explanationEs": por qué es un error, en español}',
  [CurriculumItemKind.EXERCISE]:
    '{"prompt": enunciado (en el idioma; si es de completar, marca el hueco con ___), "type": "multiple_choice", "options": [4 opciones en el idioma], "answerKey": [la opción correcta, copiada EXACTAMENTE de options], "explanationEs": explicación en español}',
  [CurriculumItemKind.RUBRIC]:
    '{"title": nombre de la rúbrica, "criteria": [{"name": criterio, "descriptorEs": qué se evalúa, "maxPoints": entero 1-10, "bands": [{"points": entero, "descriptorEs": descripción}]}] (3-4 criterios)}',
};

// [Tokens de salida por elemento · 2026-10-24]: margen según la longitud de la forma JSON | `Partial<Record>`: el resto usa 450
const TOKENS_PER_ITEM: Readonly<Partial<Record<CurriculumItemKind, number>>> = {
  [CurriculumItemKind.GRAMMAR_RULE]: 650,
  [CurriculumItemKind.PRONUNCIATION]: 800,
  [CurriculumItemKind.RUBRIC]: 700,
};

// [Instrucciones por tipo · 2026-10-24]: cada tipo recibe SOLO las reglas que le aplican (antes la regla gramatical recibía también las de traducción, IPA y género → confundía al modelo)
// [Patrón]: Lookup Table + Strategy | [Principio]: ISP aplicado al prompt (cada tipo, sus instrucciones)
const LEXICAL = new Set<CurriculumItemKind>([
  CurriculumItemKind.VOCABULARY,
  CurriculumItemKind.PRONUNCIATION,
]); // Llevan IPA de palabra
// [ARTICLE_EXERCISE · 2026-11-05]: en ejercicios con sustantivos se evalúa el artículo (o el clasificador): las opciones difieren en él y la respuesta lo incluye
const ARTICLE_EXERCISE: Readonly<Partial<Record<Language, string>>> = {
  [Language.DE]:
    'Si el ejercicio usa sustantivos, al menos la mitad deben evaluar el artículo correcto (der/die/das) o el plural: las opciones solo difieren en el artículo y la respuesta lo incluye (p. ej. "___ Tisch" → "der").',
  [Language.FR]:
    'Si el ejercicio usa sustantivos, al menos la mitad deben evaluar el artículo correcto (le/la/l’/les): las opciones difieren en el artículo y la respuesta lo incluye.',
  [Language.PT]:
    'Si el ejercicio usa sustantivos, al menos la mitad deben evaluar el artículo correcto (o/a/os/as): las opciones difieren en el artículo y la respuesta lo incluye.',
  [Language.ES]:
    'Si el ejercicio usa sustantivos, al menos la mitad deben evaluar el artículo correcto (el/la/los/las): las opciones difieren en el artículo y la respuesta lo incluye.',
  [Language.EN]:
    'Si el ejercicio usa sustantivos, incluye preguntas sobre a/an/the y sobre contables e incontables (sin artículo cuando el inglés no lo usa).',
  [Language.ZH]:
    'Si el ejercicio usa sustantivos con números o cantidades, al menos la mitad deben evaluar el clasificador correcto (个/本/张…): las opciones difieren en el clasificador.',
};

const KIND_RULES: Readonly<Partial<Record<CurriculumItemKind, string>>> = {
  // [2026-11-05 · Regla obligatoria de vocabulario]: cada sustantivo es una unidad gramatical completa (artículo/género/plural/clasificador según el idioma)
  [CurriculumItemKind.VOCABULARY]:
    'Vocabulario: si es sustantivo, incluye SIEMPRE sus datos gramaticales según el idioma. Alemán: "lemma" con der/die/das ("der Tisch"), "plural" con artículo ("die Tische"), "gender". Francés: "lemma" con le/la/l\' ("le livre", "l\'école"), "plural" ("les livres"), "gender" masculino o femenino. Portugués: "lemma" con o/a ("o livro"), "plural" con os/as ("os livros"), "gender". Español: "lemma" con el/la ("el libro"), "plural" con los/las ("los libros"), "gender". Inglés: "lemma" con a/an/the solo cuando el uso natural lo pide ("a book", "an apple"; incontables sin artículo: "water") y en "partOfSpeech" indica contable o incontable. Ruso: SIN artículo; "gender" masculino/femenino/neutro y "plural" en nominativo plural. Mandarín: SIN artículo; "lemma" en caracteres, "romanization" con pinyin y "classifier" con numeral ("一本书"). No traduzcas literalmente los artículos de un idioma a otro.',
  [CurriculumItemKind.GRAMMAR_RULE]:
    'Regla gramatical: "title" es el nombre de la regla en español o en el idioma (p. ej. "Present perfect"); si creas varias, cada una trata un ASPECTO DISTINTO del tema (afirmativa, negativa, preguntas, usos…) con un título diferente. "explanationEs" es UN texto (no una lista). Cada ejemplo es un OBJETO con "text" en el idioma y "translationEs" en español.',
  [CurriculumItemKind.PRONUNCIATION]:
    'Pronunciación: si el tema es un fonema (p. ej. "/ɒ/ · hot"), TODO el recurso trata de ESE sonido: "phoneme" es ese símbolo, y la palabra clave, las 5 palabras y las 3 frases lo contienen. Explica en "ruleEs" cuándo aparece (grafías y posiciones) y en "articulationEs" cómo se produce. Si creas varios, cada uno usa una palabra clave distinta.',
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
export type DraftStrategy = 'existing' | 'cache' | 'llm' | 'template'; // [2026-11-13 · Caso D]: + plantilla curada (sin LLM)

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
// [Presupuesto de reintentos · 2026-10-27]: un lote de 3 elementos tarda 1–2 min en CPU; antes se encadenaban hasta 3 inferencias por petición (≈ 6 min)
// y el formulario repetía además los lotes incompletos → ~6,5 min para crear 10 recursos. Ahora no se EMPIEZA otro intento pasado este plazo: se devuelve lo válido
// y el cliente pide solo lo que falta | [Patrón]: Deadline (presupuesto de tiempo) | [Principio]: Fail Fast — la petición siempre cabe en los 300 s del BFF
export const DRAFT_BUDGET_MS = 90_000;
// [Tope de exclusiones en el prompt · 2026-10-27]: cada titular excluido son tokens que el CPU evalúa antes de generar (80 → 40 ≈ −10/20 s por llamada) | los repetidos igual se filtran después
const EXCLUDE_IN_PROMPT = 40;
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

export { withArticle } from '../../domain/content/vocabulary-grammar'; // [2026-11-06]: movido al dominio (compatibilidad de imports)

// [cleanDraft]: correcciones deterministas SIN inventar contenido | [Paradigma]: Funcional
// - variante IPA ausente → la del idioma · - romanización solo en zh/ru (los modelos pequeños la inventan para otros idiomas)
function cleanDraft(language: Language, raw: unknown): Record<string, unknown> {
  const draft = normalizeShape(
    (raw && typeof raw === 'object' && !Array.isArray(raw)
      ? { ...raw }
      : {}) as Record<string, unknown>,
  );
  normalizeIpa(draft);
  clipOptionalTexts(draft);
  const ipa = draft.ipa as { value?: string; variant?: string } | undefined;
  if (ipa?.value && !ipa.variant) ipa.variant = DEFAULT_VARIANT[language];
  // [answerKey · 2026-10-20]: los modelos pequeños devuelven a veces la respuesta como texto ("A") en vez de lista (["A"]) → se envuelve (no se inventa nada)
  if (typeof draft.answerKey === 'string') draft.answerKey = [draft.answerKey];
  // [Chino · 2026-10-20]: el modelo pone el pinyin en el campo principal y los caracteres en `romanization` → se intercambian si es así
  if (language === Language.ZH) swapPinyin(draft);
  withArticle(language, draft); // [2026-11-05]: la palabra se guarda con su artículo (der Tisch)
  contentIpa(language, draft); // [2026-11-06]: … y su IPA también (der Tisch → /deːɐ̯ tɪʃ/)
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

// [Normalización de forma · 2026-10-24]: correcciones ESTRUCTURALES sin inventar contenido — los modelos locales pequeños (qwen2.5:3b) devuelven a menudo:
//   · claves sin el sufijo "Es" ("explanation", "translation") o sinónimos ("formula", "rule") → se renombran
//   · textos como lista de frases (["Se usa…", "Se forma…"]) → se unen en un texto
//   · ejemplos como cadenas («I have eaten - He comido») → objeto {text, translationEs}; los que no traen traducción se descartan (el esquema la exige)
// [Bug que corrige]: las reglas gramaticales generadas por IA fallaban con «La IA devolvió un contenido no válido (explanationEs: Expected string…)»
// [Patrón]: Normalizer / Anti-Corruption Layer (LLM → dominio) | [Paradigma]: Funcional (copia, sin efectos fuera)
const KEY_ALIASES: Readonly<Record<string, string>> = {
  explanation: 'explanationEs',
  explicacion: 'explanationEs',
  translation: 'translationEs',
  traduccion: 'translationEs',
  formula: 'structure',
  pattern: 'structure',
  rule: 'ruleEs',
  articulation: 'articulationEs',
  example: 'examples',
};
const TEXT_FIELDS = [
  'title',
  'structure',
  'explanationEs',
  'ruleEs',
  'articulationEs',
  'translationEs',
  'text',
  'lemma',
] as const;
// [Separadores habituales]: «frase - traducción» / «frase = traducción» / «frase → traducción» (PAIR_RE) y «frase (traducción)» (PAREN_RE) | `+?` (RegExp): captura perezosa → corta en el PRIMER separador
const PAIR_RE = /^(.+?)\s+(?:[-–—=→]|->)\s+(.+)$/;
const PAREN_RE = /^(.+?)\s*\((.+)\)\s*$/;

function renameKeys(o: Record<string, unknown>): Record<string, unknown> {
  // `Object.entries/fromEntries` (ES2019): renombra solo si la clave canónica no existe ya
  return Object.fromEntries(
    Object.entries(o).map(([k, v]) => {
      const canonical = KEY_ALIASES[k];
      return canonical && !(canonical in o) ? [canonical, v] : [k, v];
    }),
  );
}

// [toExample]: objeto o cadena → {text, translationEs} | null si no hay traducción posible (no se inventa)
function toExample(e: unknown): Record<string, unknown> | null {
  if (typeof e === 'string') {
    const m = PAIR_RE.exec(e.trim()) ?? PAREN_RE.exec(e.trim()); // `??` (ES2020): primer patrón que encaje
    return m ? { text: m[1].trim(), translationEs: m[2].trim() } : null;
  }
  if (!e || typeof e !== 'object') return null;
  const o = renameKeys(withoutNulls(e as Record<string, unknown>)); // Sin `null` en romanization/translationEs opcionales
  return typeof o.text === 'string' &&
    typeof o.translationEs === 'string' &&
    o.translationEs.trim()
    ? o
    : null;
}

// [withoutNulls · 2026-10-24]: los modelos locales devuelven `null` en campos opcionales ("gender": null, "source": null) y Zod solo admite `undefined` → 422 «expected string, received null» en vocabulario francés | `null` = «sin dato» → se quita la clave (no se inventa nada) | [Paradigma]: Funcional (copia)
const withoutNulls = (o: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null)); // `Object.fromEntries` (ES2019): reconstruye el objeto sin las claves nulas

// [normalizeIpa · 2026-10-24]: IPA como cadena ("/mɛ.zɔ̃/") → {value}; objeto con `value` vacío → sin IPA (es opcional en vocabulario y FastAPI la completa después) | [Patrón]: Normalizer
function normalizeIpa(d: Record<string, unknown>): void {
  const ipa = d.ipa;
  if (typeof ipa === 'string') {
    if (ipa.trim()) d.ipa = { value: ipa.trim() };
    else delete d.ipa;
    return;
  }
  if (!ipa || typeof ipa !== 'object' || Array.isArray(ipa)) return; // Forma desconocida: el esquema dará el error legible
  const clean = withoutNulls(ipa as Record<string, unknown>);
  if (typeof clean.value !== 'string' || !clean.value.trim()) delete d.ipa;
  else d.ipa = clean;
}

// [Topes de los textos opcionales cortos]: espejo de curriculum-content.schema (partOfSpeech ≤ 40, gender ≤ 20, emoji ≤ 16) | un "sustantivo masculino singular contable…" demasiado largo se recorta por palabra en vez de rechazar el recurso entero
const OPTIONAL_TEXT_LIMITS: Readonly<Record<string, number>> = {
  partOfSpeech: 40,
  gender: 20,
};
function clipOptionalTexts(d: Record<string, unknown>): void {
  for (const [field, max] of Object.entries(OPTIONAL_TEXT_LIMITS)) {
    const v = d[field];
    if (typeof v !== 'string' || v.length <= max) continue;
    const cut = v.slice(0, max); // `slice` (JS): primeros `max` caracteres
    const lastSpace = cut.lastIndexOf(' ');
    d[field] = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim(); // Corta en el último espacio → nunca media palabra
  }
  // [Emoji]: un "emoji" larguísimo no es un emoji (el modelo escribió texto) → se descarta (apoyo visual opcional)
  if (typeof d.emoji === 'string' && [...d.emoji].length > 4) delete d.emoji; // `[...str]` (ES2015): cuenta puntos de código, no unidades UTF-16
}

// [readableProblems · 2026-10-24]: mensajes de Zod (inglés técnico) → español para el docente: «gender: tipo incorrecto (llegó vacío)» en vez de «Invalid input: expected string, received null» | [Patrón]: Error Translation | [Paradigma]: Funcional (pura)
const TYPE_ES: Readonly<Record<string, string>> = {
  string: 'texto',
  object: 'objeto',
  array: 'lista',
  number: 'número',
  null: 'vacío (null)',
  boolean: 'sí/no',
};
export function readableProblem(problem: string): string {
  return problem
    .replace(
      /Invalid input: expected (\w+), received undefined/g,
      'falta el campo',
    )
    .replace(
      /Invalid input: expected (\w+), received (\w+)/g,
      (_m, exp: string, got: string) =>
        `se esperaba ${TYPE_ES[exp] ?? exp} y llegó ${TYPE_ES[got] ?? got}`,
    )
    .replace(
      /Too small: expected string to have >=1 characters?/g,
      'está vacío',
    )
    .replace(
      /Too big: expected string to have <=(\d+) characters?/g,
      'demasiado largo (máx. $1 caracteres)',
    )
    .replace(
      /Too big: expected array to have <=(\d+) items?/g,
      'demasiados elementos (máx. $1)',
    );
}

export function normalizeShape(
  d: Record<string, unknown>,
): Record<string, unknown> {
  const out = renameKeys(withoutNulls(d));
  for (const f of TEXT_FIELDS) {
    const v = out[f];
    // Lista de textos → un solo texto (las explicaciones se separan por espacio; nunca se pierde una frase)
    if (Array.isArray(v) && v.every((x) => typeof x === 'string'))
      out[f] = v.join(' ');
  }
  if (out.examples !== undefined) {
    const list = Array.isArray(out.examples) ? out.examples : [out.examples]; // Un solo ejemplo suelto → lista
    out.examples = list
      .map(toExample)
      .filter((x): x is Record<string, unknown> => x !== null);
  }
  if (Array.isArray(out.words))
    // Palabras de una ficha de fonema: cadena → {text}; objeto → claves canónicas
    out.words = out.words
      .map((w) =>
        typeof w === 'string'
          ? { text: w }
          : w && typeof w === 'object'
            ? renameKeys(withoutNulls(w as Record<string, unknown>))
            : null,
      )
      .filter(
        (w): w is Record<string, unknown> =>
          !!w && typeof w.text === 'string' && w.text.trim() !== '',
      );
  if (typeof out.phoneme === 'string')
    out.phoneme = out.phoneme.replace(/[/[\]]/g, '').trim(); // Sin barras ni corchetes
  return out;
}

// [itemsOf · 2026-10-24]: lista de borradores en la respuesta — {"items": [...]}, un array suelto, {"rules": [...]} u otro nombre, o un único objeto
export function itemsOf(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [data];
  const o = data as Record<string, unknown>;
  if (Array.isArray(o.items)) return o.items;
  if (headlineText(o)) return [o]; // Ya es un elemento (tiene lemma/text/title…)
  // Primera propiedad que sea una lista de objetos (p. ej. "rules", "grammar_rules")
  const list = Object.values(o).find(
    (v) =>
      Array.isArray(v) &&
      v.length > 0 &&
      v.every((x) => x && typeof x === 'object' && !Array.isArray(x)),
  );
  return (list as unknown[] | undefined) ?? [o];
}

// [phonemeOf · 2026-10-24]: tema «/ɒ/ · hot» (catálogo IPA) → "ɒ" | null si el tema no es un fonema
export const phonemeOf = (topic: string): string | null =>
  /\/([^/\s]{1,8})\//.exec(topic)?.[1] ?? null;

// [swapPinyin]: campo de texto sin caracteres chinos + romanización CON caracteres → estaban al revés | también en los ejemplos | Funcional (muta la copia)
const HAN_RE = /\p{Script=Han}/u;
function swapPinyin(d: Record<string, unknown>): void {
  for (const field of ['lemma', 'text']) {
    const main = d[field];
    const rom = d.romanization;
    if (
      typeof main === 'string' &&
      typeof rom === 'string' &&
      !HAN_RE.test(main) &&
      HAN_RE.test(rom)
    ) {
      d[field] = rom;
      d.romanization = main;
    }
  }
  if (Array.isArray(d.examples))
    (d.examples as Array<Record<string, unknown>>).forEach(
      (e) => e && typeof e === 'object' && swapPinyin(e),
    );
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
    @Optional() private readonly nouns?: NounGrammarService, // [2026-11-06]: artículo, género y plural AL GENERAR (opcional: tests sin FastAPI)
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
    // [Fix 2026-10-28 · Orden]: lo guardado PRIMERO y lo del formulario (lo más reciente) AL FINAL → el prompt toma los últimos EXCLUDE_IN_PROMPT
    // (antes los recién generados quedaban fuera del prompt al pasar de 40 → la IA los repetía y el lote acababa en 422 «solo propuso elementos que ya existen»)
    const exclude = [
      ...new Set(
        [
          ...existingInTopic.data.map((i) => headlineText(i.content)),
          ...(input.exclude ?? []),
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

    // ── 1b) [2026-11-13 · Caso D · RNF-37]: regla gramatical con plantilla curada → NO se genera libremente con un modelo pequeño
    // (la IA publicó «a antes de consonantes sonoras»). Se entregan las reglas verificadas que aún no están en el tema; quedan como borrador para revisión
    const templates =
      input.kind === CurriculumItemKind.GRAMMAR_RULE
        ? curatedGrammar(input.language, input.topic)
        : null;
    if (templates) {
      const fresh = templates
        .filter((t) => !excluded.has(textKey(t.title))) // Sin repetir lo que ya tiene el tema o el formulario
        .slice(0, count)
        .map((t) => ({
          content: structuredClone(t) as unknown as Record<string, unknown>,
        })); // `structuredClone` (Web API/Node 17+): copia mutable de la plantilla inmutable
      if (!fresh.length)
        throw new UnprocessableEntityException(
          'Este tema ya tiene todas las reglas curadas. Revísalas y publícalas, o escribe una nueva a mano.',
        );
      return {
        strategy: 'template',
        llmRequired: false,
        content: fresh[0]!.content,
        drafts: fresh,
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
        // [2026-11-06]: borradores guardados antes de la regla → también salen con artículo/género/plural
        if (input.kind === CurriculumItemKind.VOCABULARY && this.nouns) {
          const contents = cached.map((g) => g.content);
          await this.completeNouns(input.language, contents, actorId);
          cached.forEach((g, i) => (g.content = contents[i]!));
        }
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
    const deadline = Date.now() + DRAFT_BUDGET_MS; // `Date.now()` (JS): ms desde epoch → plazo absoluto de esta petición
    for (let attempt = 0; attempt < 3 && valid.length < count; attempt++) {
      // [Deadline]: reintentar solo si queda presupuesto; si ya hay válidos se devuelven (el cliente pide el resto) y si no hay ninguno se informa el motivo
      if (attempt > 0 && Date.now() >= deadline) break;
      const missing = count - valid.length;
      const res = await this.llm.generateJson(
        this.prompt(input, missing, problems, avoid, repeated),
        // [Presupuesto de tokens por tipo · 2026-10-24]: reglas y fichas de fonema son más largas → antes se cortaban (JSON incompleto)
        Math.min(350 + (TOKENS_PER_ITEM[input.kind] ?? 450) * missing, 3500),
        [0.3, 0.6, 0.85][attempt],
      );
      metrics = res.metrics;
      // Un elemento → objeto; varios → {"items": [...]} (se toleran también arrays sueltos y otros nombres de lista: itemsOf)
      const raws = itemsOf(res.data);
      problems = [];
      repeated = [];
      for (const raw of raws.slice(0, missing + 2)) {
        if (valid.length >= count) break;
        const draft = cleanDraft(input.language, raw);
        // [Fonema del tema · 2026-10-24]: tema «/ɒ/ · hot» y la IA no indicó el símbolo → se toma del tema (determinista)
        const phoneme = phonemeOf(input.topic);
        if (
          input.kind === CurriculumItemKind.PRONUNCIATION &&
          phoneme &&
          !draft.phoneme
        )
          draft.phoneme = phoneme;
        const result = validateCurriculumContent(input.kind, draft); // [Validación de dominio]: mismo esquema que el contenido manual
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
        `La IA devolvió un contenido no válido (${[...new Set(problems)].slice(0, 3).map(readableProblem).join(' | ')}). Intenta de nuevo, prueba otro tema o complétalo a mano.`, // `new Set`: sin repetir el mismo motivo de cada intento
      );
    }

    // [2026-11-06 · Regla obligatoria de vocabulario]: el modelo pequeño ignora «der Tisch» del prompt → se completa aquí, en UNA llamada para todo el lote
    if (input.kind === CurriculumItemKind.VOCABULARY && this.nouns)
      await this.completeNouns(input.language, valid, actorId);

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

  // [completeNouns]: sustantivos sin artículo/género/plural/clasificador → /noun-grammar/batch → solo se rellena lo que falta (muta `valid`) | fallo → quedan igual
  private async completeNouns(
    language: Language,
    valid: Record<string, unknown>[],
    actorId: string,
  ): Promise<void> {
    const idx = valid
      .map((c, i) => (needsGrammar(language, c) ? i : -1))
      .filter((i) => i >= 0);
    if (!idx.length) return;
    const terms = idx.map((i) => {
      const lemma = String(valid[i]!.lemma ?? '').trim();
      const art = articleInLemma(language, lemma);
      return art ? lemma.slice(art.length).trim() : lemma; // «der Tisch» → «Tisch»
    });
    const results = await this.nouns!.many(terms, language, actorId);
    idx.forEach((i, k) => {
      const r = results[k];
      const next = r ? applyGrammar(language, valid[i]!, r) : null;
      if (next) valid[i] = contentIpa(language, next)!; // [2026-11-10]: el artículo llegó tarde → el IPA del borrador también lo lleva (antes solo al guardar)
    });
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
    const lexical = LEXICAL.has(input.kind); // ¿Lleva IPA y traducción de palabra?
    return [
      `Eres un profesor experto de ${lang} para hispanohablantes.`,
      count === 1
        ? `Crea UN recurso ORIGINAL de tipo "${kindLabel}" para nivel MCER ${input.level}, habilidad "${skill}", tema "${input.topic}".`
        : `Crea ${count} recursos ORIGINALES y DISTINTOS entre sí de tipo "${kindLabel}" para nivel MCER ${input.level}, habilidad "${skill}", tema "${input.topic}".`,
      `IDIOMA OBLIGATORIO: las palabras, frases y opciones del recurso se escriben en ${lang} (código ${input.language}), NUNCA en español. Solo los campos que terminan en "Es" (traducciones y explicaciones) van en español.`,
      // [Calidad de traducción e IPA]: instrucciones explícitas para modelos pequeños (errores observados: sweater → "gorro", hoodie → "hoodie", IPA americana con variante en-GB)
      // [2026-10-24]: solo para tipos léxicos (vocabulario y pronunciación) → la regla gramatical ya no recibe instrucciones de IPA/género que no le aplican
      lexical
        ? 'translationEs: la traducción española MÁS COMÚN y exacta de la palabra (no una palabra parecida ni otra prenda u objeto); no copies la palabra original salvo que en español se use igual (p. ej. "hotel").'
        : '',
      lexical
        ? `IPA: transcripción fonética de la variante ${DEFAULT_VARIANT[input.language]}${input.language === Language.EN ? ' (inglés británico: NO rótico, p. ej. "water" /ˈwɔːtə/, "sweater" /ˈswetə/)' : ''}, entre barras.`
        : '',
      input.kind === CurriculumItemKind.VOCABULARY
        ? GENDERED.has(input.language)
          ? 'gender: el género gramatical del sustantivo en el idioma objetivo, o "" si no aplica.'
          : 'gender: siempre "" (este idioma no tiene género gramatical).'
        : '',
      KIND_RULES[input.kind] ?? '',
      ROMANIZED.has(input.language) ? '' : 'No incluyas romanización.',
      'No copies material protegido ni preguntas de exámenes oficiales.',
      input.guidance ?? '', // [Etapa 5]: formato de la certificación + originalidad
      exclude.length
        ? `NO repitas estos elementos que ya existen: ${exclude.slice(-EXCLUDE_IN_PROMPT).join(', ')}.` // `slice(-n)` (JS): los n MÁS RECIENTES (los que la IA tiende a repetir)
        : '',
      problems.length
        ? `Tu respuesta anterior fue rechazada por: ${problems.slice(0, 3).join(' | ')}. Corrígelo.`
        : '',
      repeated.length
        ? `Repetiste elementos que YA EXISTEN (${repeated.slice(0, 10).join(', ')}): propón otros DIFERENTES del mismo tema, también menos frecuentes o más específicos.`
        : '',
      // [Fix 2026-10-28 · Variedad]: con muchos elementos ya creados se pide explorar sub-aspectos del tema → más elementos NUEVOS por ronda (pedir 16 de un tema ya no se queda en 4)
      exclude.length >= 6
        ? 'Ya hay muchos elementos de este tema: explora sub-aspectos, situaciones, sinónimos o casos menos frecuentes pero útiles para el nivel, sin salirte del tema.'
        : '',
      input.language === Language.ZH
        ? 'Chino: el campo principal (lemma/text/source) y los ejemplos van en caracteres chinos (汉字); el pinyin con tonos va SOLO en "romanization".'
        : '',
      input.language === Language.RU
        ? 'Ruso: el campo principal y los ejemplos van en alfabeto cirílico; la transliteración latina va SOLO en "romanization".'
        : '',
      // [2026-11-05 · Regla de vocabulario]: los ejercicios también evalúan artículos y clasificadores
      input.kind === CurriculumItemKind.EXERCISE &&
      ARTICLE_EXERCISE[input.language]
        ? ARTICLE_EXERCISE[input.language]
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
