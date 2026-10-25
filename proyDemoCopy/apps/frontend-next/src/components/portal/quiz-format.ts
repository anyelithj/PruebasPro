import type { Category, Difficulty } from "@/types/quiz";
import { categoryLabel as categoryLabelSSOT } from "@/lib/categories";
import { DIFFICULTY_LABEL_ES } from "@/lib/constants";

// [Delegado al SSOT]: etiqueta + banda MCER/CEFR | [Principio]: DRY + SSOT
const DIFFICULTY_LABEL: Readonly<Record<Difficulty, string>> = DIFFICULTY_LABEL_ES;

// [Delegado al SSOT de categorías]: evita duplicar el catálogo | [Principio]: DRY + SSOT
export function categoryLabel(c: Category): string {
  return categoryLabelSSOT(c);
}

export function difficultyLabel(d: Difficulty): string {
  return DIFFICULTY_LABEL[d] ?? d;
}

export function totalMinutes(timePerQuestionSeconds: number, questions: number): number {
  return Math.max(1, Math.round((timePerQuestionSeconds * questions) / 60));
}
