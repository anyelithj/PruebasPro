// [Enum SectionType · Sprint 10.9 · RF-133]: tipos de sección de una ficha de gramática — uso, fórmula, negativa, interrogativa, nota y errores comunes (como la imagen de referencia) | [Patrón]: Enum como tupla `as const` | [Principio]: SSOT (DTOs, borrador de IA y Angular usan la misma lista) | [Paradigma]: Declarativo

export const SECTION_TYPES = [
  'usage', // Uso: cuándo se emplea
  'formula', // Fórmula: estructura afirmativa
  'negative', // Negativa
  'interrogative', // Interrogativa
  'note', // Nota: excepciones o matices
  'common_errors', // Errores comunes
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const isSectionType = (v: unknown): v is SectionType =>
  (SECTION_TYPES as readonly unknown[]).includes(v);
