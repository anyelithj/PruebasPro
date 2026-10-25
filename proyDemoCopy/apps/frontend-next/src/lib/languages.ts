import type { Language } from "@/types/quiz";
import type { CefrLevel } from "@/types/courses";
// [SSOT idiomas objetivo]: código ISO 639-1 + etiqueta ES, alineado con Language VO del backend | [Patrón]: Single Source of Truth | [Principio]: DRY + SSOT

export interface LanguageMeta {
  value: Language;
  label: string;
}

export const LANGUAGES: ReadonlyArray<LanguageMeta> = [
  { value: "en", label: "Inglés" },
  { value: "fr", label: "Francés" },
  { value: "de", label: "Alemán" },
  { value: "es", label: "Español" },
  { value: "pt", label: "Portugués" },
  { value: "zh", label: "Chino mandarín" },
  { value: "ru", label: "Ruso" },
];

// [Tupla para z.enum]: zod exige al menos un literal | [Patrón]: Schema Source
export const LANGUAGE_VALUES = LANGUAGES.map((l) => l.value) as [Language, ...Language[]];

export const DEFAULT_LANGUAGE: Language = "en";

const BY_VALUE = new Map<string, LanguageMeta>(LANGUAGES.map((l) => [l.value, l]));

// [Etiqueta legible]: fallback al código si no se reconoce | [Principio]: Robustez
export const languageLabel = (value?: string): string =>
  value ? (BY_VALUE.get(value)?.label ?? value) : "—";

// [Guard]: valida entrada cruda (BFF) | [Principio]: Robustez
export const isLanguage = (value: unknown): value is Language =>
  typeof value === "string" && BY_VALUE.has(value);

// [LEVEL_OPTIONS · 2026-10-24]: niveles MCER con nombre (el autor no necesita saber qué significa «B2») | [Principio]: SSOT + DRY (Crear recurso · Crear actividad)
export const LEVEL_OPTIONS: ReadonlyArray<{ value: CefrLevel; label: string }> = [
  { value: "A1", label: "A1 · Principiante" },
  { value: "A2", label: "A2 · Básico" },
  { value: "B1", label: "B1 · Intermedio" },
  { value: "B2", label: "B2 · Intermedio alto" },
  { value: "C1", label: "C1 · Avanzado" },
  { value: "C2", label: "C2 · Dominio" },
];
