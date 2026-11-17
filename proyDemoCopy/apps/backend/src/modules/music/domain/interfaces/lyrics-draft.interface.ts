// [Port LyricsDraftPort · 2026-10-24 · RF-117]: letra ORIGINAL de una canción didáctica generada por IA (idioma, nivel CEFR y tema) sin que el caso de uso conozca Ollama | [Patrón]: Port (Hexagonal) | [Principio]: DIP + ISP | [Paradigma]: POO

export const LYRICS_DRAFT = Symbol('LYRICS_DRAFT'); // `Symbol` (ES2015): token de inyección único

export interface LyricsDraftInput {
  language: string; // ISO 639-1 (uno de los siete idiomas)
  level: string; // A1–C2 → vocabulario y gramática acordes
  topic: string; // De qué trata (p. ej. «la rutina de la mañana», «el pasado simple»)
  title?: string; // Título deseado (si no, lo propone la IA)
  // [artist · 2026-10-27]: referencia de ESTILO («canción original al estilo de …»: género, temas, vocabulario y estructura) — nunca su letra real (derechos de autor)
  artist?: string;
}

export interface LyricsDraft {
  title: string;
  stanzas: string[][]; // Estrofas → versos (el estribillo se repite como estrofa)
  model: string; // Modelo que la generó (trazabilidad: lo de la IA se revisa)
  warning?: string; // [Fix 2026-10-28]: resultado parcial (pocos versos) → aviso para el docente | `?` (TS): ausente si la letra está completa
}

export interface LyricsDraftPort {
  draft(input: LyricsDraftInput): Promise<LyricsDraft>;
}
