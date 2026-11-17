import * as z from 'zod'; // [Tree-shaking · Zod 4]: import de namespace (`* as z`) → esbuild empaqueta solo las funciones usadas (con `{ z }` arrastraba Zod entero, ~450 kB)
import type { TranscriptLine } from '@shared/ui/organisms/synced-transcript/transcript-line.model';
// [Modelo Music · Dominio · Sprints 9.8–9.10]: colecciones, canciones, líneas con IPA/traducción/tiempos y prácticas — contrato de /api/music/* de NestJS | [Patrón]: Schema-First (Zod) + funciones puras | [Principio]: SSOT + Type-Safe | [Paradigma]: Funcional

export const SONG_STATUSES = ['draft', 'review', 'published', 'rejected'] as const;
export type SongStatus = (typeof SONG_STATUSES)[number];
export const PRACTICE_KINDS = ['gap_fill', 'order_lines', 'mark_words'] as const;
export type SongPracticeKind = (typeof PRACTICE_KINDS)[number];
// [2026-10-24]: requisitos de publicación (espejo de NestJS music/domain/song-readiness) → checklist del asistente
export const SONG_BLOCKERS = ['license', 'lyrics', 'level'] as const; // [2026-11-16 · RF-148]: + nivel (null hasta estimarlo de la letra) // [2026-10-31]: el audio ya no bloquea la publicación (opcional)
export type SongBlocker = (typeof SONG_BLOCKERS)[number];
export const MAX_AUDIO_MB = 100; // [2026-11-03]: 20 → 100 (MP4) // Mismo límite que NestJS (MAX_SONG_AUDIO_BYTES) y el BFF de Next.js

const LicenseSchema = z.object({
  type: z.enum(['public_domain', 'creative_commons', 'own_work', 'permission']),
  source: z.string(),
  holder: z.string(),
  variant: z.string().nullable().optional(),
  confirmed: z.boolean(),
});

export const SongLineSchema = z.object({
  id: z.string(),
  songId: z.string(),
  position: z.number().int(),
  text: z.string(),
  ipa: z.string().default(''),
  ipaUs: z.string().nullable().default(null),
  translation: z.string().nullable().default(null),
  startS: z.number().nullable().default(null),
  endS: z.number().nullable().default(null),
  timingSource: z.enum(['manual', 'auto']).nullable().default(null),
  reviewed: z.boolean().default(false),
  needsNativeReview: z.boolean().default(false),
});
export type SongLine = z.infer<typeof SongLineSchema>;

// [EMBED_ORIGINS · 2026-11-03]: espejo de EMBED_HOSTS (NestJS music/domain/media-links.ts) → únicos <iframe> permitidos
export const EMBED_ORIGINS = ['https://www.youtube-nocookie.com', 'https://open.spotify.com', 'https://w.soundcloud.com', 'https://player.vimeo.com', 'https://widget.deezer.com', 'https://embed.music.apple.com'] as const;

export const SongSchema = z.object({
  id: z.string(),
  title: z.string(),
  artist: z.string().default(''),
  titleIpa: z.string().default(''), // [2026-11-10]: glosa del título guardada → sin esperar a la IA
  titleTranslation: z.string().default(''),
  language: z.string(),
  level: z.string().nullable().transform((v) => v ?? ''), // [2026-11-16 · RF-148]: '' = aún sin nivel (se estima de la letra)
  status: z.enum(SONG_STATUSES),
  license: LicenseSchema,
  reviewNote: z.string().default(''),
  audioKey: z.string().nullable().default(null),
  // [2026-11-03]: reproductor oficial embebido (YouTube, Spotify…) · solo orígenes de la lista (defensa ante un valor manipulado en la BD)
  embedUrl: z
    .string()
    .refine((u) => EMBED_ORIGINS.some((o) => u.startsWith(o + '/')))
    .nullable()
    .catch(null)
    .default(null),
  createdBy: z.string(),
  practiceIds: z.record(z.string(), z.string()).default({}),
  createdAt: z.string().default(''),
  blockers: z.array(z.enum(SONG_BLOCKERS)).optional(), // [2026-10-24]: solo en vistas de gestión (autor o ADMIN)
});
export type Song = z.infer<typeof SongSchema>;

export const SongDetailSchema = SongSchema.extend({
  lines: z.array(SongLineSchema),
  editable: z.boolean().default(false),
});
export type SongDetail = z.infer<typeof SongDetailSchema>;

// [LyricsLoadSchema · 2026-10-24]: resultado de cargar/reintentar la letra — `missing` = versos aún sin IPA o sin traducción (0 = completo)
export const LyricsLoadSchema = z.object({
  lines: z.array(SongLineSchema),
  enriched: z.boolean(),
  missing: z.number().int().nonnegative().default(0),
  // [2026-10-27]: `more` = NestJS cortó la tanda por tiempo y quedan versos por intentar (se pide otra a /lines/enrich) · `unavailable` = el servicio de IA no respondió a nada
  more: z.boolean().default(false),
  unavailable: z.boolean().default(false),
});
export type LyricsLoad = z.infer<typeof LyricsLoadSchema>;

// [MediaLinkRules · 2026-10-24]: dominios de páginas de letras y de streaming — los define NestJS (music/domain/media-links.ts) y llegan por GET /music/link-rules | [Principio]: SSOT (la lista no se copia en el cliente)
export const MediaLinkRulesSchema = z.object({
  lyricsHosts: z.array(z.string()),
  streamingHosts: z.array(z.string()),
});
export type MediaLinkRules = z.infer<typeof MediaLinkRulesSchema>;
export const NO_LINK_RULES: MediaLinkRules = { lyricsHosts: [], streamingHosts: [] }; // Sin reglas (aún cargando o sin red) → solo se valida el formato; el servidor decide
// [MediaLinkKind]: misma clasificación que el backend (classifyMediaLink) | unión de literales (TS)
export type MediaLinkKind = 'empty' | 'invalid' | 'lyrics_page' | 'streaming_page' | 'direct';

// [classifyMediaLink]: texto pegado → tipo de enlace | Función pura (Specification) · `URL` (WHATWG) valida y normaliza el host · dominio exacto o subdominio (`endsWith('.' + h)`)
export function classifyMediaLink(raw: string, rules: MediaLinkRules): MediaLinkKind {
  const text = raw.trim();
  if (!text) return 'empty';
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return 'invalid';
  }
  if (!/^https?:$/.test(url.protocol)) return 'invalid';
  const host = url.hostname.toLowerCase();
  const matches = (list: readonly string[]) => list.some((h) => host === h || host.endsWith(`.${h}`));
  if (matches(rules.lyricsHosts)) return 'lyrics_page';
  if (matches(rules.streamingHosts)) return 'streaming_page';
  return 'direct';
}

// [LyricsDraftSchema · 2026-10-24]: borrador de letra ORIGINAL con IA (no se guarda hasta que el docente lo carga)
export const LyricsDraftSchema = z.object({
  title: z.string(),
  lyrics: z.string(),
  lines: z.number().int(),
  model: z.string().default(''),
  warning: z.string().optional(), // [Fix 2026-10-28]: letra parcial (pocos versos) → aviso visible; `optional()` (Zod): ausente si está completa
});
export type LyricsDraft = z.infer<typeof LyricsDraftSchema>;
export interface LyricsDraftInput {
  language: string;
  level: string;
  topic: string;
  title?: string;
  artist?: string; // [2026-10-27]: referencia de estilo («canción original al estilo de …»), nunca su letra real
}

// [publishBlockers]: lo que falta para enviar a revisión/publicar — el servidor lo calcula (`blockers`); si no llega, se deduce del audio y las líneas | Función pura
export const publishBlockers = (s: Pick<SongDetail, 'lines' | 'blockers'>): SongBlocker[] =>
  s.blockers ?? (s.lines.length ? [] : ['lyrics']);

export const CollectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().default(''),
  language: z.string(),
  level: z.string().nullable().default(null),
  theme: z.string().nullable().default(null),
  emoji: z.string().default('🎵'),
  songIds: z.array(z.string()).default([]),
  createdBy: z.string(),
  songCount: z.number().int().optional(),
});
export type Collection = z.infer<typeof CollectionSchema>;
export const CollectionDetailSchema = CollectionSchema.extend({ songs: z.array(SongSchema) });
export type CollectionDetail = z.infer<typeof CollectionDetailSchema>;

export const PracticeRefSchema = z.object({
  kind: z.enum(PRACTICE_KINDS),
  activityId: z.string(),
  reused: z.boolean().optional(),
});
export type PracticeRef = z.infer<typeof PracticeRefSchema>;

export const LineTimingSchema = z.object({
  id: z.string(),
  index: z.number(),
  start: z.number().nullable(),
  end: z.number().nullable(),
  confidence: z.number(),
});
export type LineTiming = z.infer<typeof LineTimingSchema>;

// [Entradas]: mismas reglas que los DTO de NestJS (class-validator)
export interface SongInput {
  title: string;
  artist?: string;
  language: string;
  level?: string; // [2026-11-16 · RF-148]: sin nivel → NestJS lo estima de la letra
  license: z.infer<typeof LicenseSchema>;
}
// [2026-11-10 · Editar canción]: datos + glosa del título (idioma fijo: la letra ya está en ese idioma)
export type SongPatch = Partial<Omit<SongInput, 'language'>> & { titleIpa?: string; titleTranslation?: string };
export interface CollectionInput {
  title: string;
  description?: string;
  language: string;
  level?: string;
  theme?: string;
  emoji?: string;
  songIds?: string[];
}
export interface LinePatch {
  id: string;
  text?: string;
  ipa?: string;
  ipaUs?: string;
  translation?: string;
  startS?: number;
  endS?: number;
}
export interface SongFilter {
  language?: string;
  level?: string;
  collection?: string;
  status?: SongStatus;
  mine?: boolean;
}

// [toTranscript]: línea de la canción → línea del texto sincronizado compartido | Función pura
export const toTranscript = (l: SongLine): TranscriptLine => ({
  id: l.id,
  text: l.text,
  ipa: l.ipa,
  ipaUs: l.ipaUs,
  translation: l.translation,
  start: l.startS,
  end: l.endS,
});

// [tapTimings]: tiempos marcados al ritmo (inicio de cada línea) → inicio y fin; la última termina con el audio | Función pura (testeable)
export function tapTimings(
  starts: readonly (number | null)[],
  duration: number,
): { startS: number; endS: number }[] {
  return starts.flatMap((s, i) => {
    if (s == null) return [];
    const next = starts.slice(i + 1).find((x): x is number => x != null);
    return [{ startS: round(s), endS: round(Math.max(s + 0.2, next ?? duration)) }];
  });
}
const round = (n: number) => Math.round(n * 100) / 100;

// [fmtTime]: 75.4 → «1:15» | Función pura
export const fmtTime = (s: number | null | undefined): string =>
  s == null || Number.isNaN(s)
    ? '—'
    : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
