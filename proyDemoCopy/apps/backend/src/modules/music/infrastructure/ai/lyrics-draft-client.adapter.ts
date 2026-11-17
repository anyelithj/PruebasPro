import {
  GatewayTimeoutException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OllamaClient } from '../../../ai/ollama.client';
import { LANGUAGE_NAME_EN, type Language } from '../../../../shared/domain/language.vo';
import type {
  LyricsDraft,
  LyricsDraftInput,
  LyricsDraftPort,
} from '../../domain/interfaces/lyrics-draft.interface';
// [Adapter LyricsDraftClient · 2026-10-24 · RF-117]: implementa LyricsDraftPort con el OllamaClient compartido (salida JSON restringida) y valida la forma antes de devolverla; el IPA y la traducción los pone después FastAPI (mismo flujo que una letra pegada)
// [Modelo]: aya-expanse (multilingüe: escribe bien en los siete idiomas, incluidos chino y ruso) — el mismo que ya usa el ai-service → un solo modelo residente en RAM
// [Patrón]: Adapter + Filter (valida y acota el JSON del LLM) | [Principio]: DIP + DRY (único cliente de Ollama) + Fail Fast | [Paradigma]: POO + funcional

const MAX_STANZAS = 8;
const MAX_LINES_PER_STANZA = 8;
const MAX_LINE_CHARS = 120;

// [promptValue · 2026-10-27]: texto del docente → una sola línea sin comillas ni llaves (no puede cerrar la cadena del prompt ni inyectar instrucciones nuevas) | Función pura exportada para las pruebas | [Seguridad]: mitigación de prompt injection
export const promptValue = (v: string | undefined, max = 160): string =>
  (v ?? '').replace(/[\r\n"{}`<>]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

// [styleLines · 2026-10-27]: con autor → «canción ORIGINAL al estilo de X» (el estilo no tiene derechos de autor; la letra sí) | sin autor → prompt original
// [Legal]: prohibición explícita de reproducir, citar o parafrasear letras existentes (también la del mismo título) → para la letra real se usa la importación (enlace o archivo) | Función pura exportada para las pruebas
export function styleLines(artist: string | undefined, title: string | undefined): string[] {
  const who = promptValue(artist);
  if (!who) return ['Never copy existing copyrighted songs.'];
  const same = promptValue(title);
  return [
    `Style reference: write it in the style of ${who} — similar genre, mood, typical themes, kind of vocabulary, rhythm and song structure.`,
    `The style is only inspiration: do NOT reproduce, quote, translate or paraphrase any lyrics by ${who} or by anyone else${same ? `, and do NOT recreate the existing song titled "${same}"` : ''}. Every line must be newly written; no famous hooks or catchphrases from real songs.`,
  ];
}

// [cleanStanzas]: JSON del LLM → estrofas válidas (cadenas recortadas, sin etiquetas «[Chorus]» ni numeración) | Función pura exportada para las pruebas
export function cleanStanzas(raw: unknown): string[][] {
  return (Array.isArray(raw) ? raw : [])
    .map((st) =>
      (Array.isArray(st) ? st : typeof st === 'string' ? st.split(/\r?\n/) : []) // Algunos modelos devuelven la estrofa como un único string
        .filter((l): l is string => typeof l === 'string') // `l is string` (TS): type guard → el resto del encadenamiento es string[]
        .map((l) => l.replace(/^\s*(\d+[.)]|[-•*])\s*/, '').replace(/\s+/g, ' ').trim())
        .filter((l) => l && !/^\[[^\]]*\]$/.test(l) && !/^\(?(chorus|verse|estribillo|coro|refrain)\b/i.test(l))
        .map((l) => l.slice(0, MAX_LINE_CHARS))
        .slice(0, MAX_LINES_PER_STANZA),
    )
    .filter((st) => st.length)
    .slice(0, MAX_STANZAS);
}

// ───── [Lectura tolerante del JSON · Fix 2026-10-28] ─────
// [Bug que corrige]: «La IA no devolvió suficientes versos» aunque el modelo SÍ había escrito la letra: los modelos locales devuelven
// {"lyrics": "verso\nverso"}, {"verse1": [...], "chorus": [...]}, {"song": {...}} o un JSON cortado por `num_predict` → `raw.stanzas` no existía y se descartaba todo
// [Patrón]: Tolerant Reader + Anti-Corruption Layer (LLM → dominio) | [Principio]: Postel (liberal al leer, estricto al devolver) | [Paradigma]: Funcional (puras, exportadas para pruebas)
const LYRICS_KEYS = ['stanzas', 'lyrics', 'verses', 'lines', 'song', 'letra', 'estrofas', 'text']; // Nombres habituales de la lista de estrofas
const SECTION_RE = /^(verse|chorus|bridge|refrain|hook|outro|intro|pre[-_ ]?chorus|estrofa|estribillo|coro|puente|couplet|strophe|strofa|куплет|припев)/i; // Claves «verse1», «chorus»…

// [stanzasFrom]: cualquier forma razonable → estrofas limpias (vacío si no hay letra) | `unknown` (TS): se inspecciona sin asumir la forma
export function stanzasFrom(raw: unknown, depth = 0): string[][] {
  if (depth > 3 || raw === null || raw === undefined) return []; // Tope de recursión: JSON anidado arbitrario no cuelga el proceso
  if (typeof raw === 'string')
    return cleanStanzas(raw.split(/\r?\n\s*\r?\n/)); // Texto plano: estrofas separadas por una línea en blanco
  if (Array.isArray(raw)) {
    // Lista de versos sueltos (["l1","l2",…]) → estrofas de 4 | lista de estrofas → tal cual
    if (raw.every((x) => typeof x === 'string') && raw.every((x) => !(x as string).includes('\n')))
      return cleanStanzas(chunk(raw as string[], 4));
    return cleanStanzas(raw.map((x) => (x && typeof x === 'object' && !Array.isArray(x) ? stanzasFrom(x, depth + 1).flat() : x)));
  }
  if (typeof raw !== 'object') return [];
  const o = raw as Record<string, unknown>;
  for (const k of LYRICS_KEYS) {
    const found = stanzasFrom(o[k], depth + 1);
    if (found.length) return found;
  }
  // Secciones con nombre («verse1», «chorus») en el orden en que llegaron | `Object.entries` (ES2017) conserva el orden de inserción
  const sections = Object.entries(o)
    .filter(([k]) => SECTION_RE.test(k))
    .map(([, v]) => stanzasFrom(v, depth + 1).flat())
    .filter((st) => st.length);
  return cleanStanzas(sections);
}

// [chunk]: divide una lista en trozos de `size` | Función pura
const chunk = <T>(xs: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(xs.length / size) }, (_, i) => xs.slice(i * size, i * size + size)); // `Array.from({length})` (ES2015)

// [parseLyricsResponse]: texto de Ollama → { title, stanzas } aunque el JSON venga envuelto en texto o CORTADO (num_predict agotado)
// 1) JSON.parse · 2) el objeto {…} más externo · 3) rescate: cadenas entre comillas que no son claves (los versos ya escritos no se pierden)
export function parseLyricsResponse(text: string): { title: string; stanzas: string[][] } {
  const tryParse = (t: string): unknown => {
    try {
      return JSON.parse(t) as unknown;
    } catch {
      return undefined; // `catch` sin variable (ES2019): se prueba la siguiente estrategia
    }
  };
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  const data = tryParse(text) ?? (start >= 0 && end > start ? tryParse(text.slice(start, end + 1)) : undefined);
  if (data !== undefined) {
    const o = (data && typeof data === 'object' && !Array.isArray(data) ? data : {}) as Record<string, unknown>;
    return { title: typeof o.title === 'string' ? o.title : '', stanzas: stanzasFrom(data) };
  }
  // [Rescate]: se recorren TODAS las cadenas JSON en orden (`"(?:[^"\\]|\\.)*"` con escapes) consumiéndolas → las claves («"title":») se descartan mirando el carácter siguiente
  // (un lookahead negativo no basta: el motor reintentaría desde dentro de la clave y capturaría «:» como verso)
  const strings = [...text.matchAll(/"((?:[^"\\]|\\.)*)"(\s*:)?/g)]
    .filter((m) => !m[2]) // `m[2]` = «:» tras la cadena → era una clave
    .map((m) => {
      const v = tryParse(`"${m[1]}"`); // Deshace los escapes (\n, \u00e9…) con el propio parser JSON
      return typeof v === 'string' ? v : m[1];
    });
  const titleMatch = /"title"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(text);
  const title = titleMatch ? String(tryParse(`"${titleMatch[1]}"`) ?? titleMatch[1]) : '';
  return { title, stanzas: stanzasFrom(strings.filter((l) => l !== title)) };
}

// [Presupuesto de tiempo · Fix 2026-10-28]: aya-expanse:8b en CPU tarda 2–5 min con arranque en frío y el OllamaClient esperaba hasta 600 s
// → el fetch del BFF de Next.js (undici, 300 s) cortaba antes y el docente veía «El servidor no responde» | ahora: intento ≤ 150 s y reintento SOLO si queda margen
// [Patrón]: Deadline + Retry (una vez) | [Principio]: Fail Fast — la respuesta siempre llega antes que el corte del BFF
export const LYRICS_ATTEMPT_MS = 150_000;
export const LYRICS_BUDGET_MS = 240_000;
const MIN_RETRY_WINDOW_MS = 60_000; // Sin al menos 1 min libre no se empieza otro intento (no acabaría a tiempo)
export const MIN_LINES = 4; // Menos que esto no es una canción (ni una estrofa)
const TARGET_LINES = 12; // Lo esperado (≈ 3 estrofas de 4) → por debajo se devuelve con aviso

@Injectable()
export class LyricsDraftClient implements LyricsDraftPort {
  private readonly logger = new Logger(LyricsDraftClient.name);
  private readonly model: string;

  constructor(
    private readonly ollama: OllamaClient,
    config: ConfigService,
  ) {
    this.model =
      config.get<string>('OLLAMA_AYA_MODEL') ??
      config.get<string>('OLLAMA_CURRICULUM_MODEL') ??
      'aya-expanse:8b';
  }

  async draft(input: LyricsDraftInput): Promise<LyricsDraft> {
    const deadline = Date.now() + LYRICS_BUDGET_MS; // `Date.now()` (JS): plazo absoluto de toda la petición
    let best: { title: string; stanzas: string[][] } = { title: '', stanzas: [] };
    let lastError: unknown = null;
    // [Reintento único · Fix 2026-10-28]: si el primer intento trae pocos versos (o falla) se pide otra vez con más variedad, solo si cabe en el plazo
    for (let attempt = 0; attempt < 2; attempt++) {
      const left = deadline - Date.now();
      if (attempt > 0 && left < MIN_RETRY_WINDOW_MS) break;
      try {
        const res = await this.ollama.generate({
          model: this.model,
          prompt: this.prompt(input, attempt > 0),
          // `num_predict` 700 (antes 900): 4 estrofas de 4 versos caben de sobra y la inferencia en CPU es ~20 % más corta
          options: { temperature: attempt ? 0.9 : 0.8, top_p: 0.9, num_predict: 700, num_ctx: 2048 },
          timeoutMs: Math.min(LYRICS_ATTEMPT_MS, left), // [Deadline]: nunca más que lo que queda del presupuesto
        });
        const parsed = parseLyricsResponse(res.response ?? '');
        if (parsed.stanzas.flat().length > best.stanzas.flat().length) best = parsed; // Se queda con el mejor intento (más versos)
      } catch (err) {
        lastError = err; // 503/504 traducido por OllamaClient («tardó demasiado», «no instalado»…)
        this.logger.warn(`Letra con IA: intento ${attempt + 1} falló — ${err instanceof Error ? err.message : String(err)}`);
        // [Sin reintento tras un plazo vencido]: otro intento igual de lento superaría el corte del BFF → se informa ya
        if (err instanceof GatewayTimeoutException) break;
      }
      if (best.stanzas.flat().length >= MIN_LINES) break; // Suficiente → no se gasta otra inferencia
    }
    const lines = best.stanzas.flat().length;
    if (!lines) {
      // Ningún verso: se propaga el error real de Ollama (p. ej. 504 «tardó demasiado») o se explica que la respuesta no traía letra
      if (lastError instanceof HttpException) throw lastError;
      throw new ServiceUnavailableException(
        'La IA no devolvió versos utilizables (respuesta vacía o con otro formato). Intenta de nuevo, cambia el tema o pega la letra a mano.',
      );
    }
    // [Resultado parcial · Fix 2026-10-28]: algunos versos son mejor que nada → se devuelven para revisar, con un aviso claro (antes 503 y se perdían)
    const warning =
      lines < TARGET_LINES
        ? `La IA solo escribió ${lines} verso${lines === 1 ? '' : 's'}. Revísalos y completa la letra a mano o vuelve a generarla.`
        : undefined;
    return {
      title: (input.title?.trim() || best.title.trim() || input.topic.trim()).slice(0, 160),
      stanzas: best.stanzas,
      model: this.model,
      ...(warning ? { warning } : {}), // Spread condicional (ES2018): la clave solo existe si hay aviso
    };
  }

  // [prompt]: instrucciones en inglés (los modelos las siguen mejor); la LETRA en el idioma estudiado | `retry`: recuerda la forma exacta del JSON | [Principio]: SRP
  private prompt(input: LyricsDraftInput, retry: boolean): string {
    const lang = LANGUAGE_NAME_EN[input.language as Language] ?? input.language;
    return [
      `Write ORIGINAL song lyrics in ${lang} (language code "${input.language}") for language learners at CEFR level ${input.level}.`,
      `Topic: ${promptValue(input.topic, 200)}.`, // [2026-10-27]: valores del docente saneados (una línea, sin comillas)
      input.title ? `Song title: "${promptValue(input.title)}".` : 'Also propose a short, catchy title in the same language.',
      `Use vocabulary and grammar suitable for ${input.level}; short lines (3-10 words), natural rhythm and simple rhymes; repeat a chorus so learners can sing along.`,
      'Structure: verse, chorus, verse, chorus (optionally a bridge and a final chorus). 4 lines per stanza.',
      ...styleLines(input.artist, input.title), // [2026-10-27]: autor = referencia de estilo, nunca su letra
      'Do not translate, do not add IPA, do not label stanzas.',
      retry ? 'Your previous answer had too few lines: write AT LEAST 4 stanzas of 4 lines each.' : '',
      'Return ONLY JSON: {"title":"...","stanzas":[["line 1","line 2","line 3","line 4"],["..."]]}.',
    ]
      .filter(Boolean) // Quita la línea condicional vacía
      .join('\n');
  }
}
