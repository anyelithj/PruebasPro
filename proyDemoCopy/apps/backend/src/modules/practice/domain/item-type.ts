// [Enum ItemType + Skill · Sprint 8.12 · RF-110/RF-111]: tipos de ítem de práctica y habilidad que evalúa cada uno | [Patrón]: Lookup Table + SSOT (espejo de FastAPI grading/application/schemas/evaluate_request.py) | [Principio]: OCP | [Paradigma]: Declarativo

export const ITEM_TYPES = [
  'multiple_choice', // Opción múltiple
  'fill_blank', // Completar huecos
  'match_pairs', // Emparejar arrastrando
  'drag_order', // Ordenar arrastrando (estructura)
  'mark_errors', // Marcador: pulsar las palabras incorrectas
  'open_answer', // Respuesta abierta (semántica + explicación con LLM)
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

// [Contenidos vinculados · 2026-10-23]: una actividad reúne material de otras secciones (p. ej. «Los alimentos» → vocabulario, un juego, una canción)
export const CONTENT_KINDS = ['vocabulary', 'grammar', 'game', 'music', 'dialogue', 'polyglot', 'resource', 'link'] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];
export interface ActivityContent {
  kind: ContentKind;
  label: string; // Texto visible («Vocabulario · Los alimentos»)
  href: string; // Ruta interna (/resources/tema?…, /juegos/…) o enlace https
}

export const SKILLS = ['structure', 'grammar', 'vocabulary'] as const; // Estructura, gramática o vocabulario (RF-112)
export type Skill = (typeof SKILLS)[number];
