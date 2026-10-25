"use client";
import type { AnswerFeedback, QuestionPublic, SessionAnswer } from "@/types/quiz";
// [FeedbackPanel]: muestra retroalimentación IA por respuesta incorrecta | [Patron]: Presentational | [Principio]: SRP | [Paradigma]: Funcional + Declarativo

export interface FeedbackPanelProps {
  answers: SessionAnswer[];
  questions: QuestionPublic[];
  feedbacks: Record<string, AnswerFeedback>;
}

const FALLBACK_FEEDBACK =
  "Revisa el concepto clave de esta pregunta. Intenta descomponer el problema en pasos más pequeños.";

export function FeedbackPanel({ answers, questions, feedbacks }: FeedbackPanelProps) {
  const incorrect = answers.filter((a) => !a.isCorrect);

  if (incorrect.length === 0) {
    return (
      <section
        aria-label="Retroalimentación de la IA"
        className="rounded-xl border border-tone-brand-line bg-tone-brand-soft p-5"
      >
        <h2 className="text-lg font-bold text-tone-brand">
          Excelente desempeño
        </h2>
        <p className="mt-1 text-sm text-tone-brand">
          No tuviste respuestas incorrectas. Sigue con quizzes de mayor dificultad para consolidar.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Retroalimentación de la IA" aria-live="polite" className="space-y-3">
      <h2 className="text-xl font-bold tracking-tight">Retroalimentación IA</h2>
      <p className="text-sm text-muted-foreground">
        Análisis pedagógico generado por el tutor IA para cada respuesta incorrecta.
      </p>

      <ul className="space-y-3">
        {incorrect.map((answer) => {
          const question = questions.find((q) => q.id === answer.questionId);
          const fb = feedbacks[answer.questionId];
          const message = fb?.feedback ?? FALLBACK_FEEDBACK;
          return (
            <li key={answer.questionId} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold flex-1">
                  {question?.text ?? `Pregunta ${answer.questionId.slice(0, 8)}`}
                </p>
                <span
                  className="rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  aria-label="Respuesta incorrecta"
                >
                  Incorrecta
                </span>
              </div>
              <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                <div>
                  <span className="font-semibold">Respuesta:</span>{" "}
                  <span className="font-mono">{answer.userAnswer || "(vacía)"}</span>
                </div>
              </div>
              <div className="mt-3 rounded-lg bg-primary/5 border border-primary/15 p-3 text-sm">
                <p className="text-foreground">{message}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
