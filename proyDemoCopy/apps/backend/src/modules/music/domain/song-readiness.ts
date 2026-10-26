import { type License, licenseProblem } from './value-objects/license.vo';
// [Specification SongReadiness · 2026-10-24 · RF-116/RF-128]: qué le falta a una canción para enviarse a revisión o publicarse — una SSOT para el caso de uso (rechaza con 400) y para las respuestas (la UI deshabilita «Publicar» y muestra la lista ANTES de llamar al servidor)
// [Decisión de dominio]: el audio sigue siendo obligatorio — la canción es karaoke (tiempos por línea, propuesta de Alignment, prácticas de escucha) y la licencia declarada cubre el audio publicado; sin audio no hay actividad que publicar. La IA genera la letra, pero el audio lo sube (o lo enlaza) el docente
// [Patrón]: Specification + Value Object (códigos estables) | [Principio]: SSOT + Fail Fast + OCP (requisito nuevo = una entrada) | [Paradigma]: Funcional (funciones puras)

// `as const` (TS): tupla de literales → el tipo de unión sale del mismo arreglo (SSOT)
export const SONG_BLOCKERS = ['license', 'audio', 'lyrics'] as const;
export type SongBlocker = (typeof SONG_BLOCKERS)[number];

// [Entrada mínima]: `Pick` (TS) → solo los campos que decide la regla (ISP); sirve con la entidad o con un objeto de prueba
export interface ReadinessInput {
  license: License | null | undefined;
  audioKey: string | null;
}

// [BLOCKER_MESSAGES]: texto en español para el 400 y para la UI de NestJS | `Readonly<Record<…>>` (TS): tabla inmutable
export const BLOCKER_MESSAGES: Readonly<Record<SongBlocker, string>> = {
  license: 'Falta completar la licencia',
  audio: 'Falta subir el audio',
  lyrics: 'Falta la letra',
};

// [songBlockers]: lista ordenada de lo que falta (vacía = lista para revisión/publicación) | Función pura
export function songBlockers(song: ReadinessInput, lineCount: number): SongBlocker[] {
  const out: SongBlocker[] = [];
  if (licenseProblem(song.license)) out.push('license');
  if (!song.audioKey) out.push('audio');
  if (lineCount <= 0) out.push('lyrics');
  return out;
}

// [blockersMessage]: «Falta subir el audio · Falta la letra» (la licencia con su motivo concreto) | null = sin bloqueos | Función pura
export function blockersMessage(song: ReadinessInput, blockers: readonly SongBlocker[]): string | null {
  if (!blockers.length) return null;
  return blockers
    .map((b) => (b === 'license' ? (licenseProblem(song.license) ?? BLOCKER_MESSAGES.license) : BLOCKER_MESSAGES[b]))
    .join(' · ');
}
