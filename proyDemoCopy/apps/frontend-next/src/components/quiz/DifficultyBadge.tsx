import { cn } from "@/lib/utils";
import type { Difficulty } from "@/types/quiz";
// [Atom DifficultyBadge]: chip de color por nivel | [Patron]: Atomic Design (atom) | [Principio]: SRP

const STYLES: Record<Difficulty, string> = {
  easy: "bg-success/10 text-success border-success/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  hard: "bg-danger/10 text-danger border-danger/20",
};

const LABELS: Record<Difficulty, string> = {
  easy: "Facil",
  medium: "Medio",
  hard: "Dificil",
};

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold",
        STYLES[difficulty],
      )}
    >
      {LABELS[difficulty]}
    </span>
  );
}
