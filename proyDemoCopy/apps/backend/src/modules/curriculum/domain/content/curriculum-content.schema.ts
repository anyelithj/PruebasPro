import { z } from 'zod';
import { CurriculumItemKind } from '../value-objects/curriculum-item-kind.vo';
import {
  Language,
  LANGUAGE_LABEL,
} from '../../../../shared/domain/language.vo';
// [Especificación del contenido]: un esquema por tipo de recurso para que el JSONB sea estructurado y reutilizable, no texto libre | [Patrón]: Specification + Schema Registry | [Principio]: OCP + SRP | [Paradigma]: Declarativo
// [Tecnología]: Zod (librería de validación pura, sin E/S ni framework) → el dominio sigue independiente de NestJS/TypeORM

// `const` + funciones auxiliares: bloques reutilizables entre esquemas | [Principio]: DRY
const text = (max: number) => z.string().trim().min(1).max(max); // Texto obligatorio con límite (evita payloads enormes)
const optionalText = (max: number) => z.string().trim().max(max).optional(); // `.optional()` (Zod): admite undefined

// [IPA con referencia dialectal]: la variante es OBLIGATORIA (no se afirma una pronunciación universal) | [Regla del producto]
const ipaSchema = z.object({
  value: text(200), // Transcripción IPA, p. ej. /ˈwɔːtə/
  variant: text(20), // Variante regional BCP-47, p. ej. en-GB, en-US, pt-BR, pt-PT
  source: optionalText(300), // Diccionario o referencia de la transcripción
});

// [Ejemplo con traducción]: reutilizado por reglas y vocabulario
// [Imagen embebida]: data URL WebP/PNG/JPEG en base64, reducida en el navegador (≤ 256 px) → sin servidor de archivos extra | máx. ~110 KB
const imageSchema = z
  .string()
  .max(150_000)
  .regex(
    /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/,
    'Imagen no válida (WebP, PNG o JPEG en base64)',
  );

const exampleSchema = z.object({
  text: text(500), // Frase en el idioma objetivo
  translationEs: text(500), // Traducción al español
  romanization: optionalText(500), // Pinyin con tonos (zh) o transliteración (ru), opcional
});

// [Registro tipo → esquema]: `Record<Enum, ZodType>` obliga (en compilación) a definir un esquema para CADA tipo | [Patrón]: Registry
export const CURRICULUM_CONTENT_SCHEMAS = {
  [CurriculumItemKind.GRAMMAR_RULE]: z.object({
    title: text(160), // Nombre de la regla (p. ej. "Present perfect")
    explanationEs: text(4000), // Explicación en español
    structure: optionalText(300), // Fórmula (p. ej. "have/has + participio")
    examples: z.array(exampleSchema).max(20).default([]), // `.default([])` (Zod): array vacío si no llega
  }),
  [CurriculumItemKind.VOCABULARY]: z.object({
    lemma: text(160), // Forma canónica de la palabra
    partOfSpeech: optionalText(40), // Categoría gramatical
    gender: optionalText(20), // Género gramatical (de, fr, pt, es, ru)
    translationEs: text(300), // Traducción al español
    ipa: ipaSchema.optional(), // IPA opcional, pero si existe debe incluir variante
    romanization: optionalText(160), // Pinyin/transliteración
    examples: z.array(exampleSchema).max(10).default([]),
    emoji: optionalText(16), // [Apoyo visual]: emoji que representa la palabra (p. ej. 🍎)
    image: imageSchema.optional(), // [Apoyo visual]: imagen pequeña adjunta por el docente
  }),
  [CurriculumItemKind.EXAMPLE]: exampleSchema,
  [CurriculumItemKind.TRANSLATION]: z.object({
    source: text(1000), // Texto original
    targetEs: text(1000), // Traducción verificada al español
    notes: optionalText(1000), // Matices o alternativas válidas
  }),
  [CurriculumItemKind.PRONUNCIATION]: z.object({
    text: text(200), // Palabra o frase
    ipa: ipaSchema, // Obligatoria en este tipo
    romanization: optionalText(200),
    audioRef: optionalText(300), // Referencia a audio en caché (clave), nunca audio embebido
    ruleEs: optionalText(1000), // [2026-10-23]: regla fonética en español (p. ej. «la -ed suena /t/ tras sonido sordo»)
    examples: z.array(exampleSchema).max(10).default([]), // [2026-10-23]: frases que aplican la regla (con su IPA en la vista)
  }),
  [CurriculumItemKind.COMMON_ERROR]: z.object({
    incorrect: text(500), // Forma errónea típica
    correct: text(500), // Forma correcta
    explanationEs: text(2000), // Por qué es un error
    ruleKey: optionalText(120), // `key` de la regla gramatical relacionada (enlace por clave natural)
  }),
  [CurriculumItemKind.EXERCISE]: z
    .object({
      prompt: text(2000), // Enunciado
      type: z.enum([
        'multiple_choice',
        'true_false',
        'fill_blank',
        'open_answer',
      ]), // `z.enum` (Zod): literal cerrado
      options: z.array(text(300)).max(8).optional(), // Opciones (solo multiple_choice)
      answerKey: z.array(text(500)).min(1).max(10), // Respuestas aceptadas → corrección determinista SIN LLM
      explanationEs: optionalText(2000),
      rubricKey: optionalText(120), // Rúbrica asociada (open_answer)
    })
    // `.superRefine` (Zod): validación cruzada entre campos | [Patrón]: Specification compuesta
    .superRefine((ex, ctx) => {
      // Regla: una pregunta de opción múltiple necesita opciones y la clave debe estar entre ellas
      if (ex.type === 'multiple_choice') {
        if (!ex.options || ex.options.length < 2) {
          ctx.addIssue({
            code: 'custom',
            path: ['options'],
            message: 'multiple_choice requiere al menos 2 opciones',
          });
        } else if (!ex.answerKey.every((k) => ex.options!.includes(k))) {
          ctx.addIssue({
            code: 'custom',
            path: ['answerKey'],
            message: 'Cada respuesta de answerKey debe estar en options',
          });
        }
      }
    }),
  [CurriculumItemKind.RUBRIC]: z.object({
    title: text(160),
    criteria: z
      .array(
        z.object({
          name: text(120), // Criterio (p. ej. "Coherencia")
          descriptorEs: text(1000), // Qué se evalúa
          maxPoints: z.number().int().min(1).max(100), // `z.number().int()` (Zod): entero positivo acotado
          bands: z
            .array(
              z.object({
                points: z.number().int().min(0).max(100),
                descriptorEs: text(1000),
              }),
            )
            .max(10)
            .default([]),
        })
        // [Sprint 5.5 · niveles ≤ peso]: ninguna banda puede otorgar más puntos que el peso del criterio | [Patrón]: Specification
        .refine((c) => c.bands.every((b) => b.points <= c.maxPoints), {
          message: 'Cada banda debe tener points ≤ maxPoints del criterio',
          path: ['bands'],
        }),
      )
      .min(1)
      .max(20),
  }),
} satisfies Record<CurriculumItemKind, z.ZodType>; // `satisfies` (TS 4.9): verifica el tipo sin perder la inferencia de cada esquema

// `export type` (TS): resultado discriminado → el llamador no necesita try/catch | [Patrón]: Result / Either | [Paradigma]: Funcional
export type ContentValidationResult =
  | { ok: true; content: Record<string, unknown> } // Contenido normalizado (trim, defaults)
  | { ok: false; errors: string[] }; // Mensajes legibles "campo: motivo"

// [Validador del dominio]: función pura que el caso de uso llama antes de persistir
export function validateCurriculumContent(
  kind: CurriculumItemKind,
  content: unknown,
): ContentValidationResult {
  const result = CURRICULUM_CONTENT_SCHEMAS[kind].safeParse(content); // `safeParse` (Zod): no lanza excepción
  if (result.success) {
    return { ok: true, content: result.data }; // Devuelve la versión normalizada
  }
  // `map` (ES5): convierte cada issue de Zod en "ruta: mensaje"
  return {
    ok: false,
    errors: result.error.issues.map(
      (i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`,
    ),
  };
}

// [Textos en el idioma objetivo por tipo]: campos que DEBEN estar escritos en el idioma del recurso (traducciones y explicaciones van en español) | [Patrón]: Lookup Table
type Pair = { text?: unknown; translation?: unknown }; // Texto original + su traducción (para detectar "traducción = original")
const targetTexts = (
  c: Record<string, unknown>,
): Array<{ text: string; translation?: unknown }> => {
  const examples = Array.isArray(c.examples)
    ? (c.examples as Array<{ text?: unknown; translationEs?: unknown }>).map(
        (e) => ({ text: e.text, translation: e.translationEs }),
      )
    : [];
  const options = Array.isArray(c.options)
    ? (c.options as unknown[]).map((o) => ({ text: o }))
    : [];
  return [
    { text: c.lemma },
    { text: c.text, translation: c.translationEs },
    { text: c.source, translation: c.targetEs },
    { text: c.incorrect },
    { text: c.correct },
    ...examples,
    ...options,
  ].filter(
    (p): p is Pair & { text: string } =>
      typeof p.text === 'string' && p.text.trim() !== '',
  ); // Type guard (TS): solo textos presentes
};

// [Escrituras por idioma]: Unicode Script properties (`\p{Script=…}` + flag `u`, ES2018) → detección determinista sin LLM
const HAN = /\p{Script=Han}/u;
const CYRILLIC = /\p{Script=Cyrillic}/u;
const OTHER_SCRIPTS =
  /[\p{Script=Han}\p{Script=Hangul}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const SPANISH_MARKS = /[¿¡ñÑ]/; // Signos exclusivos del español entre los 7 idiomas del catálogo
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim(); // Sin tildes ni signos

// [Regla de coherencia de idioma]: evita recursos "revueltos" (p. ej. un recurso de Inglés con la frase en español) | [Patrón]: Specification | [Paradigma]: Funcional (pura)
// 1) La variante IPA debe pertenecer al idioma · 2) la escritura debe ser la del idioma (zh → Han, ru → cirílico, resto → latino) · 3) sin signos del español si el idioma no es español · 4) una frase no puede ser igual a su traducción
export function languageMismatch(
  language: Language,
  content: Record<string, unknown>,
): string | null {
  const name = LANGUAGE_LABEL[language];
  const variant = (content.ipa as { variant?: string } | undefined)?.variant;
  // `string.startsWith` (ES2015): "fr-FR".startsWith("fr") → válido; "en-GB" en un recurso fr → error legible
  if (variant && !variant.toLowerCase().startsWith(language)) {
    return `La variante IPA "${variant}" no corresponde al idioma ${name}`;
  }
  for (const { text, translation } of targetTexts(content)) {
    const snippet = `«${text.slice(0, 60)}»`;
    if (language === Language.ZH && !HAN.test(text))
      return `El texto ${snippet} no está en ${name} (faltan caracteres chinos)`;
    if (language === Language.RU && !CYRILLIC.test(text))
      return `El texto ${snippet} no está en ${name} (falta alfabeto cirílico)`;
    if (
      language !== Language.ZH &&
      language !== Language.RU &&
      OTHER_SCRIPTS.test(text)
    )
      return `El texto ${snippet} usa una escritura que no es de ${name}`;
    if (language !== Language.ES && SPANISH_MARKS.test(text))
      return `El texto ${snippet} parece estar en español, no en ${name}`;
    // [Traducción idéntica]: solo frases (> 3 palabras) → las palabras sueltas pueden coincidir legítimamente ("hotel")
    if (
      language !== Language.ES &&
      typeof translation === 'string' &&
      text.trim().split(/\s+/).length > 3 &&
      norm(text) === norm(translation)
    ) {
      return `La frase ${snippet} es igual a su traducción: debe estar escrita en ${name}`;
    }
  }
  return null;
}
