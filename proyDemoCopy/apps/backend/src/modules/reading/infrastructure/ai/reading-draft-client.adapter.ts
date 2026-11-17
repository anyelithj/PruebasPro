import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OllamaClient } from '../../../ai/ollama.client';
import {
  CEFR_LEVEL_LABEL_ES,
  type CefrLevel,
} from '../../../../shared/domain/cefr-level.vo';
import {
  LANGUAGE_NAME_EN,
  type Language,
} from '../../../../shared/domain/language.vo';
import {
  MAX_DRAFT_WORDS,
  MIN_DRAFT_WORDS,
  type ReadingDraft,
  type ReadingDraftPort,
  type ReadingDraftRequest,
} from '../../domain/interfaces/reading-draft.interface';
import { READING_GENRE_PROMPT, ReadingGenre } from '../../domain/reading-genre';
import {
  strictLine,
  wrongLanguage,
} from '../../../../shared/domain/target-language';
import {
  DICTATION_MIN_PARAGRAPHS,
  DICTATION_MIN_SENTENCES,
  splitParagraphs,
  splitSentences,
} from '../../domain/sentence-splitter';
// [Adapter ReadingDraftClient · Lectura · 2026-10-25]: implementa ReadingDraftPort con el OllamaClient compartido (JSON restringido) y NORMALIZA la forma del JSON antes de devolverlo | [Patrón]: Adapter + Normalizer + Strategy por género (READING_GENRE_PROMPT) | [Principio]: DIP + DRY (único cliente de Ollama) + Fail Fast | [Paradigma]: POO + funcional

const MAX_PARAGRAPHS = 40;
const MAX_CONTINUATIONS = 3; // [2026-10-28]: llamadas extra máximas para alargar un borrador corto (reintentos acotados)
// [Fix 2026-10-30 · Plazos]: el presupuesto era 300 s, igual que el corte de undici en el BFF → en CPU acababa en «El servidor no responde»
// Ahora la petición entera tiene un plazo: cada continuación solo dispone de lo que queda hasta él → respuesta siempre antes de los 300 s | [Patrón]: Deadline
const DRAFT_DEADLINE_MS = 285_000; // Plazo absoluto de la petición
const MIN_CALL_MS = 60_000; // Con menos tiempo libre no se empieza otra continuación (no acabaría)
const CALL_TIMEOUT_MS = 170_000; // Tope por inferencia
const FIRST_CALL_TOKENS = 1200; // ~120 s en CPU: lo que no quepa lo completa la continuación (el JSON cortado se rescata con salvageParagraphs)
const MAX_PARAGRAPH_CHARS = 4000;
// [Vocabulario por nivel]: guía corta para que el modelo pequeño ajuste la dificultad
const LEVEL_HINT: Readonly<Record<string, string>> = {
  A1: 'very short simple sentences, present tense, the 500 most common words',
  A2: 'short sentences, present and past tense, everyday vocabulary',
  B1: 'clear connected sentences, common tenses, some linking words',
  B2: 'varied sentences, some idioms and complex structures',
  C1: 'rich vocabulary, complex sentences and nuance',
  C2: 'native-like, literary or journalistic style',
};

// [ReadingShape · 2026-10-27]: estructura mínima por nivel MCER (párrafos × frases) | antes: «2-5 párrafos, ~180 palabras» → el modelo pequeño entregaba 2 frases
// [2026-10-28]: MÁS de 5 párrafos en TODOS los niveles (≥ 6 × ~5 frases) — la dificultad la marca LEVEL_HINT (vocabulario y sintaxis), no la longitud
export interface ReadingShape {
  paragraphs: number; // Párrafos mínimos (o estrofas en un poema)
  sentences: [number, number]; // Frases por párrafo [mín, máx] (versos por estrofa en un poema)
  words: number; // Palabras objetivo (dentro de MIN/MAX_DRAFT_WORDS del DTO)
  strictMin?: number; // [2026-11-16 · Dictado]: mínimo EXACTO de frases por párrafo (sin tolerancia) → cada párrafo lo cumple o se pide más texto
}
// `Readonly<Record<…>>` (TS) + `Object.freeze` (JS): tabla inmutable | [Patrón]: Lookup Table | [Principio]: SSOT de la longitud por nivel (espejo: READING_WORDS_BY_LEVEL de Next.js)
export const READING_SHAPE: Readonly<Record<string, ReadingShape>> =
  Object.freeze({
    A1: { paragraphs: 6, sentences: [5, 5], words: 220 },
    A2: { paragraphs: 6, sentences: [5, 6], words: 300 },
    B1: { paragraphs: 6, sentences: [5, 6], words: 420 },
    B2: { paragraphs: 7, sentences: [5, 6], words: 560 },
    C1: { paragraphs: 7, sentences: [5, 6], words: 680 },
    C2: { paragraphs: 8, sentences: [5, 6], words: 800 },
  });
// [DICTATION_SHAPE · 2026-11-16]: dictado = 3 párrafos × 5–6 frases (mínimo: DICTATION_MIN_PARAGRAPHS × DICTATION_MIN_SENTENCES) · ~mitad de texto que
// una lectura → qwen2.5:3b en CPU ya no agota CALL_TIMEOUT_MS («La IA tardó demasiado…») | palabras por nivel, con tope
// [2026-11-16 · 2.º pase]: el modelo pequeño escribe ~4 frases cuando se le piden 5 → se le piden 6–7 y se exige el mínimo real (5) con `strictMin`
export const dictationShape = (level: string): ReadingShape => ({
  paragraphs: DICTATION_MIN_PARAGRAPHS,
  sentences: [DICTATION_MIN_SENTENCES + 1, DICTATION_MIN_SENTENCES + 2],
  words: Math.min(shapeOf(level, false).words, 300),
  strictMin: DICTATION_MIN_SENTENCES,
});
// [shapeOf]: forma del nivel («B1+» → B1) · poema: 6 estrofas de 4–5 versos (versos cortos → menos palabras) | Función pura
export function shapeOf(level: string, verse: boolean): ReadingShape {
  const base =
    READING_SHAPE[level.slice(0, 2).toUpperCase()] ?? READING_SHAPE.A2;
  return verse
    ? { paragraphs: 6, sentences: [4, 5], words: Math.min(base.words, 320) }
    : base;
}

// [countSentences]: frases totales del borrador (verso: líneas) | Función pura
export const countSentences = (
  paragraphs: readonly string[],
  language: string,
  verse: boolean,
): number =>
  paragraphs.reduce((n, p) => n + splitSentences(p, language, verse).length, 0);

// [minSentences · 2026-10-28]: frases mínimas aceptables = párrafos × mínimo por párrafo con un 10 % de tolerancia («~5 frases») | Función pura
export const minSentences = (shape: ReadingShape): number =>
  shape.strictMin
    ? shape.paragraphs * shape.strictMin // Dictado: sin tolerancia (3 × 5 = 15)
    : Math.ceil(shape.paragraphs * shape.sentences[0] * 0.9);

// [DraftIssue · 2026-10-27]: por qué se repite el borrador UNA vez | `type` unión de literales (TS)
export type DraftIssue =
  | { kind: 'language'; found: string }
  | { kind: 'short'; got: number }
  | { kind: 'invalid' };

// [draftIssue]: idioma equivocado (detector de 7 idiomas) o < 60 % de las frases pedidas → problema que merece REESCRIBIR; si no, null | Función pura (testeable sin Ollama)
// Lo que falte por encima del 60 % no se reescribe: se CONTINÚA (shortfall + continueDraft) → no se pierde el texto bueno
export function draftIssue(
  paragraphs: readonly string[],
  language: string,
  shape: ReadingShape,
  verse: boolean,
): DraftIssue | null {
  const found = wrongLanguage(paragraphs.join(' '), language);
  if (found) return { kind: 'language', found };
  const got = countSentences(paragraphs, language, verse);
  return got < Math.ceil(shape.paragraphs * shape.sentences[0] * 0.6)
    ? { kind: 'short', got }
    : null;
}

// [Shortfall · 2026-10-28]: cuánto falta para la forma mínima | `interface` (TS): contrato del hueco a rellenar
export interface Shortfall {
  paragraphs: number; // Párrafos nuevos a pedir (≥ 1)
  sentences: number; // Frases que faltan (puede ser 0 si solo faltan párrafos)
}

// [shortfall]: null = cumple (≥ shape.paragraphs párrafos y ≥ minSentences frases); si no, cuántos párrafos pedir en la continuación | Función pura
export function shortfall(
  paragraphs: readonly string[],
  language: string,
  shape: ReadingShape,
  verse: boolean,
): Shortfall | null {
  const got = countSentences(paragraphs, language, verse);
  const missingSentences = Math.max(minSentences(shape) - got, 0);
  const missingParagraphs = Math.max(shape.paragraphs - paragraphs.length, 0);
  if (!missingSentences && !missingParagraphs) return null;
  // `Math.ceil(x / máx)`: párrafos necesarios para cubrir las frases que faltan con párrafos «llenos»
  return {
    paragraphs: Math.max(
      missingParagraphs,
      Math.ceil(missingSentences / shape.sentences[1]),
      1,
    ),
    sentences: missingSentences,
  };
}

// [rebalance · 2026-10-28]: prosa con párrafos mal formados (de 1–2 frases o pocos párrafos enormes) → frases repartidas en párrafos de ~mín–máx frases | Función pura
// Si el modelo ya respetó la forma, sus límites de párrafo se CONSERVAN (no se toca un texto bien estructurado) · el verso nunca se reparte (las estrofas son del poema)
// [Patrón]: Normalizer | [Principio]: determinístico primero (sin otra llamada al LLM)
export function rebalance(
  paragraphs: readonly string[],
  language: string,
  shape: ReadingShape,
  verse: boolean,
): string[] {
  if (verse || !paragraphs.length) return [...paragraphs];
  // [2026-11-16]: con `strictMin` (dictado) el reparto usa ESE mínimo y un párrafo con menos frases ya no cuenta como «bien formado»
  const minS = shape.strictMin ?? shape.sentences[0];
  const maxS = shape.sentences[1];
  const perParagraph = paragraphs.map((p) => splitSentences(p, language));
  const wellFormed =
    paragraphs.length >= shape.paragraphs &&
    perParagraph.every(
      (ss) => ss.length >= (shape.strictMin ?? Math.min(3, minS)) && ss.length <= maxS * 2,
    );
  if (wellFormed) return [...paragraphs];
  const all = perParagraph.flat(); // `flat` (ES2019): todas las frases en orden
  // [Fix 2026-11-17 · Dictado]: el reparto uniforme dejaba párrafos de 4 (14 frases → 5,5,4) · con `strictMin` el número de párrafos es
  // floor(N / mín) → TODOS los párrafos llegan al mínimo (14 → 7,7 y la continuación pide el tercero) | si hay de sobra: ≥ shape.paragraphs sin pasar de maxS
  if (shape.strictMin && all.length >= minS) {
    const fit = Math.floor(all.length / minS); // Máximo de párrafos que cumplen el mínimo
    const count = Math.min(fit, Math.max(shape.paragraphs, Math.ceil(all.length / maxS)));
    return spread(all, count, language);
  }
  // Tamaño objetivo: llenar al menos `shape.paragraphs` párrafos sin pasar de `maxS` ni bajar de `minS` (si faltan frases, la continuación añade párrafos)
  const size = Math.min(
    maxS,
    Math.max(minS, Math.ceil(all.length / shape.paragraphs)),
  );
  return spread(all, Math.max(1, Math.ceil(all.length / size)), language);
}

// [spread]: frases → `count` párrafos de tamaño uniforme (p. ej. 32 frases en 6 → 6,6,5,5,5,5) | Función pura
function spread(all: readonly string[], count: number, language: string): string[] {
  // `Array.from({ length })` (ES2015): índices 0…count-1
  const base = Math.floor(all.length / count);
  const extra = all.length % count;
  let cursor = 0;
  return Array.from({ length: count }, (_, i) => {
    const n = base + (i < extra ? 1 : 0);
    const chunk = all.slice(cursor, cursor + n);
    cursor += n;
    return chunk.join(language === 'zh' ? '' : ' ');
  }).filter(Boolean);
}

// [salvageParagraphs · 2026-10-27]: JSON cortado por num_predict («…"paragraphs":["uno","dos","tr») → se recuperan las cadenas COMPLETAS | Función pura
// Antes el JSON truncado se descartaba entero (error) o, con el bloque {…} más externo, quedaba solo el título
export function salvageParagraphs(
  raw: string | undefined,
): Record<string, unknown> | null {
  const text = raw ?? '';
  const at = text.search(/"(?:paragraphs|stanzas)"\s*:\s*\[/);
  if (at < 0) return null;
  // `(?:[^"\\]|\\.)*`: cadena JSON con escapes (\" \n) · grupo `(\s*:)?` presente = era una CLAVE ({"text":"…"}) → se descarta (consumirla evita que la regex reempiece en su comilla de cierre) | `JSON.parse` del literal la decodifica
  const decode = (lit: string): string => {
    try {
      return JSON.parse(`"${lit}"`) as string;
    } catch {
      return '';
    }
  };
  const literal = /"((?:[^"\\]|\\.)*)"(\s*:)?/g;
  const list = [...text.slice(text.indexOf('[', at)).matchAll(literal)]
    .filter((m) => !m[2])
    .map((m) => decode(m[1]));
  const title = decode(
    /"title"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(text)?.[1] ?? '',
  );
  return list.some((p) => p.trim())
    ? { paragraphs: list, ...(title ? { title } : {}) }
    : null;
}

// [parseLoose]: JSON.parse y, si falla, el primer bloque {…} de la respuesta (algunos modelos añaden texto o ```json) | Función pura | null = no es JSON
export function parseLoose(
  raw: string | undefined,
): Record<string, unknown> | null {
  const text = (raw ?? '').trim();
  const attempt = (s: string): Record<string, unknown> | null => {
    try {
      const v: unknown = JSON.parse(s);
      return v && typeof v === 'object' && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  };
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  return (
    attempt(text) ??
    (first >= 0 && last > first ? attempt(text.slice(first, last + 1)) : null)
  );
}

// [paragraphsOf]: tolera las formas que devuelven los modelos pequeños → lista de párrafos limpios | Función pura
// {"paragraphs":["…"]} · {"paragraphs":[{"text":"…"}]} · {"paragraphs":[["verso","verso"]]} · {"text":"…\n\n…"} · {"body"|"content"|"story"|"poem":"…"}
export function paragraphsOf(
  raw: Record<string, unknown>,
  verse: boolean,
): string[] {
  const asText = (v: unknown): string =>
    typeof v === 'string'
      ? v
      : Array.isArray(v)
        ? v.filter((x): x is string => typeof x === 'string').join('\n')
        : v && typeof v === 'object'
          ? asText(
              (v as { text?: unknown; content?: unknown }).text ??
                (v as { content?: unknown }).content,
            )
          : '';
  const list = Array.isArray(raw.paragraphs)
    ? raw.paragraphs.map(asText)
    : Array.isArray(raw.stanzas)
      ? raw.stanzas.map(asText)
      : [];
  const fallback = asText(
    raw.text ?? raw.body ?? raw.content ?? raw.story ?? raw.poem ?? raw.article,
  );
  // Una lista con párrafos → cada uno se limpia (en verso se conservan los saltos) · un solo texto → se divide por líneas en blanco
  const paragraphs = (list.some((p) => p.trim()) ? list : [fallback]).flatMap(
    (p) => splitParagraphs(p, verse),
  );
  return (verse ? paragraphs : groupLoneSentences(paragraphs))
    .slice(0, MAX_PARAGRAPHS)
    .map((p) => p.slice(0, MAX_PARAGRAPH_CHARS));
}

// [groupLoneSentences · 2026-10-25]: el modelo pequeño a veces devuelve UNA frase por «párrafo» → se agrupan de 3 en 3 (prosa) | Función pura
export function groupLoneSentences(paragraphs: string[], size = 3): string[] {
  const lone = paragraphs.filter(
    (p) => (p.match(/[.!?…](\s|$)/g)?.length ?? 0) <= 1,
  ).length;
  if (paragraphs.length <= 3 || lone < paragraphs.length * 0.7)
    return paragraphs;
  return Array.from({ length: Math.ceil(paragraphs.length / size) }, (_, i) =>
    paragraphs.slice(i * size, i * size + size).join(' '),
  );
}

@Injectable()
export class ReadingDraftClient implements ReadingDraftPort {
  private readonly model: string;

  constructor(
    private readonly ollama: OllamaClient,
    config: ConfigService,
  ) {
    // [Mismo modelo compacto que los demás borradores] (práctica, currículo, diálogos, gramática)
    this.model =
      config.get<string>('OLLAMA_CURRICULUM_MODEL') ??
      config.get<string>('OLLAMA_QWEN_MODEL') ??
      'qwen2.5:3b';
  }

  // [draft · 2026-10-27]: 1.ª respuesta → si sale en otro idioma, demasiado corta o con JSON inválido → UN reintento con la corrección explícita en el prompt
  // y se queda la mejor de las dos (idioma correcto primero, luego más frases) | [Patrón]: Guard + Retry + Best-of-two | [Principio]: Fail Safe (nunca peor que la 1.ª)
  // [2026-10-28 · Longitud mínima garantizada]: después, mientras falten párrafos/frases (shortfall) → CONTINUACIÓN del mismo texto (hasta MAX_CONTINUATIONS
  // y DRAFT_BUDGET_MS) y reparto determinístico de frases en párrafos (rebalance) | [Patrón]: Bounded Retry + Continuation | [Principio]: Fail-soft (si la IA no da más, se devuelve lo mejor obtenido)
  async draft(req: ReadingDraftRequest): Promise<ReadingDraft> {
    const started = Date.now(); // Presupuesto de tiempo: Ollama en CPU puede tardar minutos por inferencia
    const verse = req.genre === ReadingGenre.POEM;
    const shape =
      req.kind === 'dictation' && !verse
        ? dictationShape(req.level)
        : shapeOf(req.level, verse);
    let best = await this.firstDraft(req, shape, verse);
    // `for` acotado: nunca más de MAX_CONTINUATIONS llamadas extra (coste y latencia previsibles)
    for (let round = 0; round < MAX_CONTINUATIONS; round++) {
      best = {
        ...best,
        paragraphs: rebalance(best.paragraphs, req.language, shape, verse),
      };
      const gap = shortfall(best.paragraphs, req.language, shape, verse);
      const left = DRAFT_DEADLINE_MS - (Date.now() - started);
      if (!gap || left < MIN_CALL_MS) break;
      const more = await this.continueDraft(
        req,
        shape,
        best.paragraphs,
        gap,
        Math.min(left, CALL_TIMEOUT_MS),
      );
      if (!more.length) break; // Sin progreso → no insistir (Fail-soft)
      best = {
        ...best,
        paragraphs: [...best.paragraphs, ...more].slice(0, MAX_PARAGRAPHS),
      };
    }
    // [2026-11-16 · Dictado en español con idioma inglés]: el «mejor de dos» podía seguir en otro idioma y se devolvía igual → ahora es un error claro (nunca un texto en el idioma equivocado)
    const found = wrongLanguage(best.paragraphs.join(' '), req.language);
    if (found)
      throw new ServiceUnavailableException(
        `La IA escribió el texto en otro idioma (${found}) en vez de ${req.language}. Inténtalo de nuevo o escribe el tema en ese idioma.`,
      );
    return {
      ...best,
      paragraphs: rebalance(best.paragraphs, req.language, shape, verse),
    };
  }

  // [firstDraft]: borrador inicial con UN reintento si el idioma, el JSON o la longitud (< 60 %) fallan | se queda el mejor de los dos
  private async firstDraft(
    req: ReadingDraftRequest,
    shape: ReadingShape,
    verse: boolean,
  ): Promise<ReadingDraft> {
    const first = await this.once(req, shape, null);
    const issue = first
      ? draftIssue(first.paragraphs, req.language, shape, verse)
      : { kind: 'invalid' as const };
    // [Fix 2026-10-30]: corto pero con sustancia (≥ una frase por párrafo pedido) → NO se reescribe (se perdía el texto y el tiempo): lo alarga la continuación
    if (
      first &&
      (!issue || (issue.kind === 'short' && issue.got >= shape.paragraphs))
    )
      return first;
    // `.catch`: con un primer borrador en la mano, un fallo o plazo vencido del reintento no lo tira (antes 504) | sin él, el error real se propaga
    const second = await this.once(req, shape, issue).catch((err: unknown) => {
      if (first) return null;
      throw err;
    });
    const best = [first, second]
      .filter((d): d is ReadingDraft => d !== null)
      // `sort` estable (ES2019): idioma correcto pesa más que cualquier número de frases
      .map((d) => ({
        d,
        score:
          (wrongLanguage(d.paragraphs.join(' '), req.language) ? 0 : 10_000) +
          countSentences(d.paragraphs, req.language, verse),
      }))
      .sort((a, b) => b.score - a.score)[0]?.d;
    if (!best)
      throw new ServiceUnavailableException(
        'La IA devolvió un borrador inválido. Intenta de nuevo.',
      );
    return best;
  }

  // [continueDraft · 2026-10-28]: pide `gap.paragraphs` párrafos NUEVOS que continúen el texto (sin repetirlo) · [] si la respuesta no sirve
  // (JSON inválido, otro idioma o solo repeticiones) | errores de Ollama se propagan solo si no hay nada que devolver → aquí se capturan: el borrador ya es válido
  private async continueDraft(
    req: ReadingDraftRequest,
    shape: ReadingShape,
    paragraphs: readonly string[],
    gap: Shortfall,
    timeoutMs: number,
  ): Promise<string[]> {
    const lang = LANGUAGE_NAME_EN[req.language as Language] ?? req.language;
    const verse = req.genre === ReadingGenre.POEM;
    const [minS, maxS] = shape.sentences;
    const unit = verse ? 'stanzas' : 'paragraphs';
    const per = verse
      ? `${minS}-${maxS} verses (lines)`
      : `${minS}-${maxS} sentences`;
    // Últimos ~5000 caracteres: contexto suficiente sin desbordar num_ctx | `slice(-n)` (JS): desde el final
    const soFar = paragraphs.join('\n\n').slice(-5000);
    const prompt = [
      `You are continuing ${READING_GENRE_PROMPT[req.genre]} written ENTIRELY in ${lang} for learners at CEFR ${req.level}.`,
      `Language level: ${LEVEL_HINT[req.level] ?? LEVEL_HINT.A2}.`,
      `Text so far:\n"""\n${soFar}\n"""`,
      `Write ${gap.paragraphs} NEW ${unit} that CONTINUE the text naturally (same characters, tense and style; the last one closes the ${verse ? 'poem' : 'text'}). Do NOT repeat, summarize or translate the previous text.`,
      `LENGTH (mandatory): EACH ${verse ? 'stanza' : 'paragraph'} has ${per}${verse ? '' : ' (never one or two sentences per paragraph)'}. Every sentence MUST be in ${lang}.`,
      `Return ONLY JSON: {"paragraphs":["...", ... ${gap.paragraphs} items]}.`,
    ].join('\n');
    // Palabras por frase del nivel (words / frases objetivo) → tokens a generar (~2,5 por palabra) + margen JSON, techo 3000
    const wordsPerSentence =
      shape.words / (shape.paragraphs * ((minS + maxS) / 2));
    const budget = Math.min(
      Math.round(gap.paragraphs * maxS * wordsPerSentence * 2.5) + 300,
      3000,
    );
    try {
      const res = await this.ollama.generate({
        model: this.model,
        prompt,
        timeoutMs,
        options: {
          temperature: 0.7,
          num_predict: Math.min(budget, FIRST_CALL_TOKENS),
          num_ctx: 8192,
        },
      });
      const raw = parseLoose(res.response) ?? salvageParagraphs(res.response);
      if (!raw) return [];
      // `Set` (ES2015): descarta párrafos que repiten uno existente (los modelos pequeños a veces copian el texto previo)
      const seen = new Set(paragraphs.map((p) => p.trim().toLowerCase()));
      const fresh = paragraphsOf(raw, verse).filter(
        (p) => !seen.has(p.trim().toLowerCase()),
      );
      return fresh.length && !wrongLanguage(fresh.join(' '), req.language)
        ? fresh
        : [];
    } catch {
      return []; // Ollama ocupado o timeout → se devuelve lo que ya hay (Fail-soft)
    }
  }

  // [fixLine]: primera línea del reintento según el problema detectado | Función pura (método privado sin estado)
  private fixLine(
    issue: DraftIssue | null,
    req: ReadingDraftRequest,
    shape: ReadingShape,
  ): string[] {
    if (!issue) return [];
    if (issue.kind === 'language')
      return [strictLine(req.language, issue.found)];
    if (issue.kind === 'short')
      return [
        `IMPORTANT: the previous text had only ${issue.got} sentences, which is far TOO SHORT. Write AT LEAST ${shape.paragraphs} paragraphs with ${shape.sentences[0]}-${shape.sentences[1]} sentences each.`,
      ];
    return [
      'IMPORTANT: the previous answer was not valid JSON. Return ONLY the JSON object, nothing else.',
    ];
  }

  // [once]: una inferencia · null = JSON inutilizable (el llamador decide si reintenta) | errores de Ollama (apagado, timeout) se propagan sin reintento
  private async once(
    req: ReadingDraftRequest,
    shape: ReadingShape,
    issue: DraftIssue | null,
  ): Promise<ReadingDraft | null> {
    const lang = LANGUAGE_NAME_EN[req.language as Language] ?? req.language;
    const level = CEFR_LEVEL_LABEL_ES[req.level as CefrLevel] ?? req.level;
    const verse = req.genre === ReadingGenre.POEM;
    // [2026-10-27]: la longitud nunca baja de la del nivel (el cliente puede pedir más, hasta MAX_DRAFT_WORDS)
    const words = Math.min(
      Math.max(Math.round(req.words), shape.words, MIN_DRAFT_WORDS),
      MAX_DRAFT_WORDS,
    );
    const [minS, maxS] = shape.sentences;
    const unit = verse ? 'stanzas' : 'paragraphs';
    const per = verse
      ? `${minS} verses (lines)`
      : minS === maxS
        ? `${minS} sentences`
        : `${minS}-${maxS} sentences`;
    const source = req.sourceText?.trim();
    const prompt = [
      ...this.fixLine(issue, req, shape),
      source
        ? `Adapt the following material into ${READING_GENRE_PROMPT[req.genre]} written ENTIRELY in ${lang} for learners at CEFR ${req.level} (${level}). Keep its facts; simplify to the level.`
        : `Write an ORIGINAL ${READING_GENRE_PROMPT[req.genre]} ENTIRELY in ${lang} for learners at CEFR ${req.level} (${level}) about "${req.topic}".${req.language === 'es' ? '' : ' The topic may be written in Spanish: translate it; never write the text in Spanish.'}`,
      `Language level: ${LEVEL_HINT[req.level] ?? LEVEL_HINT.A2}.`,
      // [Estructura explícita]: número MÍNIMO de párrafos (≥ 6) y frases por párrafo → los modelos pequeños respetan cuentas concretas mejor que «about N words»
      `LENGTH (mandatory): at least ${shape.paragraphs} ${unit}${shape.paragraphs > 5 ? ' (more than 5)' : ''}; EACH ${verse ? 'stanza' : 'paragraph'} has ${per}${verse ? '' : ' (never one or two sentences per paragraph)'}. About ${words} words in total.`,
      `Every sentence of the text MUST be in ${lang} (no translations, no IPA). The "title" in ${lang}; the "summary" is ONE sentence in SPANISH.`,
      `Return ONLY JSON: {"title":"...","summary":"...","paragraphs":["${verse ? 'verse 1\\nverse 2\\nverse 3\\nverse 4' : 'sentence 1. sentence 2. sentence 3. sentence 4. sentence 5.'}", ... ${shape.paragraphs} items or more]}.`,
      ...(source ? [`Material:\n${source.slice(0, 6000)}`] : []),
    ].join('\n');
    // [num_predict · 2026-10-27]: ~2,5 tokens por palabra (idiomas no ingleses y chino gastan más) + JSON y resumen, techo 3000 (cabe en OLLAMA_NUM_CTX 4096 con el prompt)
    const res = await this.ollama.generate({
      model: this.model,
      prompt,
      timeoutMs: CALL_TIMEOUT_MS,
      options: {
        temperature: 0.7,
        num_predict: Math.min(Math.round(words * 2.5) + 400, FIRST_CALL_TOKENS),
        num_ctx: 8192,
      },
    });
    // [2026-10-27]: JSON cortado → se rescatan los párrafos completos antes de rendirse
    const raw = parseLoose(res.response) ?? salvageParagraphs(res.response);
    if (!raw) return null;
    const paragraphs = paragraphsOf(raw, verse);
    if (!paragraphs.length) return null;
    return {
      title: (typeof raw.title === 'string' ? raw.title.trim() : '').slice(
        0,
        160,
      ),
      summary: (typeof raw.summary === 'string'
        ? raw.summary.trim()
        : ''
      ).slice(0, 600),
      paragraphs,
      model: this.model,
    };
  }
}
