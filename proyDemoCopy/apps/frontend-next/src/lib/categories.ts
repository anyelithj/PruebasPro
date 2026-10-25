import type { Category, LanguageSkill, LegacyCategory } from "@/types/quiz";
// [SSOT competencias lingüísticas]: valor (enum backend) + etiqueta ES + emoji en un solo lugar | [Patrón]: Single Source of Truth | [Principio]: DRY + SSOT

export interface CategoryMeta {
  value: LanguageSkill;
  label: string;
  emoji: string;
}

// [Catálogo competencias MCER]: alineado con ACTIVE_CATEGORIES del backend | [Principio]: SSOT
export const CATEGORIES: ReadonlyArray<CategoryMeta> = [
  { value: "general", label: "General", emoji: "🌐" },
  { value: "grammar", label: "Gramática", emoji: "📐" },
  { value: "vocabulary", label: "Vocabulario", emoji: "🔤" },
  { value: "reading", label: "Comprensión lectora", emoji: "📖" },
  { value: "listening", label: "Comprensión auditiva", emoji: "🎧" },
  { value: "writing", label: "Expresión escrita", emoji: "✍️" },
  { value: "speaking", label: "Expresión oral", emoji: "🗣️" },
  { value: "pronunciation", label: "Pronunciación", emoji: "🔊" },
  { value: "custom", label: "Personalizada", emoji: "✨" },
];

// [Etiquetas legacy]: solo lectura, para quizzes creados antes del cambio a idiomas | [Patrón]: Backward Compatibility
const LEGACY_LABELS: Readonly<Record<LegacyCategory, string>> = {
  language: "Lengua y Literatura",
  math: "Matemáticas",
  science: "Ciencias",
  biology: "Biología",
  physics: "Física",
  chemistry: "Química",
  history: "Historia",
  geography: "Geografía",
  social_sciences: "Ciencias Sociales",
  english: "Inglés",
  technology: "Tecnología",
  art: "Arte",
};

// [Tupla para z.enum]: zod exige al menos un literal | [Patrón]: Schema Source
export const CATEGORY_VALUES = CATEGORIES.map((c) => c.value) as [
  LanguageSkill,
  ...LanguageSkill[],
];

const BY_VALUE = new Map<string, CategoryMeta>(CATEGORIES.map((c) => [c.value, c]));

// [Etiqueta legible]: vigente → legacy → slug | [Principio]: Robustez
export const categoryLabel = (value?: string): string =>
  value
    ? (BY_VALUE.get(value)?.label ?? LEGACY_LABELS[value as LegacyCategory] ?? value)
    : "—";

// [Emoji]: fallback genérico si no se reconoce | [Principio]: Robustez
export const categoryEmoji = (value?: string): string =>
  (value && BY_VALUE.get(value as Category)?.emoji) || "❓";
