// [Modelo TranscriptLine · Sprint 9.7 · RF-117/RF-123]: una línea del texto sincronizado — original, IPA (UK y US en inglés), traducción al español, tiempos y hablante | [Patrón]: Value Object (interfaz de solo lectura) | [Principio]: DRY (canciones, diálogos y conversaciones la comparten) | [Paradigma]: Declarativo

export interface TranscriptLine {
  readonly id: string;
  readonly text: string;
  readonly ipa: string; // Variante por defecto (en: UK)
  readonly ipaUs?: string | null; // Solo inglés
  readonly translation: string | null; // null en contenido en español
  readonly start?: number | null; // Segundos desde el inicio del audio
  readonly end?: number | null;
  readonly speaker?: string | null; // Nombre del hablante (diálogos) o «Tú»/«Aula» (conversación)
  readonly note?: string | null; // Corrección suave del avatar (conversación)
}

// [lineProgress · 2026-10-23]: avance 0–1 dentro de la línea actual (marcador de karaoke palabra a palabra); null si la línea no tiene inicio y fin | Función pura
export function lineProgress(line: TranscriptLine | undefined, t: number): number | null {
  if (line?.start == null || line.end == null || line.end <= line.start) return null;
  return Math.min(Math.max((t - line.start) / (line.end - line.start), 0), 1); // `Math.min/max`: acota a [0, 1]
}

// [lineAt]: índice de la línea que suena en el segundo `t` (la última cuyo inicio ya pasó y cuyo fin no) | Función pura O(n) — las letras tienen pocas líneas
export function lineAt(lines: readonly TranscriptLine[], t: number): number {
  let current = -1;
  lines.forEach((l, i) => {
    if (l.start != null && l.start <= t && (l.end == null || t < l.end)) current = i;
  });
  return current;
}
