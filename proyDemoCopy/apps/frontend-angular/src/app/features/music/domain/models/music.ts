import { z } from 'zod';
import type { TranscriptLine } from '@shared/ui/organisms/synced-transcript/transcript-line.model';
// [Modelo Music · Dominio · Sprints 9.8–9.10]: colecciones, canciones, líneas con IPA/traducción/tiempos y prácticas — contrato de /api/music/* de NestJS | [Patrón]: Schema-First (Zod) + funciones puras | [Principio]: SSOT + Type-Safe | [Paradigma]: Funcional

export const SONG_STATUSES = ['draft', 'review', 'published', 'rejected'] as const;
export type SongStatus = (typeof SONG_STATUSES)[number];
export const PRACTICE_KINDS = ['gap_fill', 'order_lines', 'mark_words'] as const;
export type SongPracticeKind = (typeof PRACTICE_KINDS)[number];
export const MAX_AUDIO_MB = 20; // Mismo límite que NestJS (MAX_SONG_AUDIO_BYTES) y el BFF de Next.js

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

export const SongSchema = z.object({
  id: z.string(),
  title: z.string(),
  artist: z.string().default(''),
  language: z.string(),
  level: z.string(),
  status: z.enum(SONG_STATUSES),
  license: LicenseSchema,
  reviewNote: z.string().default(''),
  audioKey: z.string().nullable().default(null),
  createdBy: z.string(),
  practiceIds: z.record(z.string(), z.string()).default({}),
  createdAt: z.string().default(''),
});
export type Song = z.infer<typeof SongSchema>;

export const SongDetailSchema = SongSchema.extend({
  lines: z.array(SongLineSchema),
  editable: z.boolean().default(false),
});
export type SongDetail = z.infer<typeof SongDetailSchema>;

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
  level: string;
  license: z.infer<typeof LicenseSchema>;
}
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
