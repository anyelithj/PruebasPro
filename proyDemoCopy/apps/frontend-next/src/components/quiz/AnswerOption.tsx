"use client";
import { cn } from "@/lib/utils";
// [AnswerOption]: boton de opcion accesible | [Patron]: Atomic Design | [Principio]: SRP

export interface AnswerOptionProps {
  label: string;
  index: number;
  selected: boolean;
  disabled?: boolean;
  reveal?: "correct" | "incorrect" | null;
  onSelect: (value: string) => void;
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function AnswerOption({
  label,
  index,
  selected,
  disabled,
  reveal,
  onSelect,
}: AnswerOptionProps) {
  const stateClass =
    reveal === "correct"
      ? "border-success bg-success/10 text-foreground"
      : reveal === "incorrect"
        ? "border-danger bg-danger/10 text-foreground"
        : selected
          ? "border-primary bg-primary/10"
          : "border-border bg-card hover:border-primary/40 hover:bg-muted/30";

  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect(label)}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all flex items-center gap-3",
        "disabled:cursor-not-allowed disabled:opacity-70",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        stateClass,
      )}
    >
      <span className="grid place-items-center size-8 rounded-lg border border-border bg-background text-sm font-bold shrink-0">
        {LETTERS[index] ?? index + 1}
      </span>
      <span className="text-sm">{label}</span>
    </button>
  );
}
