"use client";
import { AnswerOption } from "./AnswerOption";
import type { QuestionPublic } from "@/types/quiz";
// [QuestionCard]: pregunta + opciones + estado seleccion | [Patron]: Composite | [Principio]: SRP | [Paradigma]: Funcional + JSX

export interface QuestionCardProps {
  question: QuestionPublic;
  selectedAnswer: string | null;
  isLocked?: boolean;
  revealCorrectAnswer?: string | null;
  onSelect: (value: string) => void;
}

export function QuestionCard({
  question,
  selectedAnswer,
  isLocked,
  revealCorrectAnswer,
  onSelect,
}: QuestionCardProps) {
  const isOpenAnswer = question.type === "open_answer";
  const isTrueFalse = question.type === "true_false";
  const options = isTrueFalse ? ["True", "False"] : question.options ?? [];

  return (
    <article className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <h2 className="text-xl sm:text-2xl font-bold leading-snug mb-6">
        {question.text}
      </h2>

      {isOpenAnswer ? (
        <input
          type="text"
          placeholder="Escribe la respuesta..."
          disabled={isLocked}
          value={selectedAnswer ?? ""}
          onChange={(e) => onSelect(e.target.value)}
          className="control w-full"
        />
      ) : (
        <div className="space-y-2.5">
          {options.map((opt, i) => {
            const reveal =
              revealCorrectAnswer && opt === revealCorrectAnswer
                ? "correct"
                : revealCorrectAnswer && selectedAnswer === opt
                  ? "incorrect"
                  : null;
            return (
              <AnswerOption
                key={`${question.id}-${i}`}
                label={opt}
                index={i}
                selected={selectedAnswer === opt}
                disabled={isLocked}
                reveal={reveal as "correct" | "incorrect" | null}
                onSelect={onSelect}
              />
            );
          })}
        </div>
      )}
    </article>
  );
}
