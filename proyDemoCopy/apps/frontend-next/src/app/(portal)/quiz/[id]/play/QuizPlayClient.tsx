"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuiz } from "@/hooks/useQuiz";
import { TimerBar } from "@/components/quiz/TimerBar";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import { QuizProgress } from "@/components/quiz/QuizProgress";
import type { Quiz } from "@/types/quiz";
// [QuizPlayClient]: orquesta el juego en cliente (Redux + timers) | [Patron]: Container | [Principio]: SRP | [Paradigma]: Funcional + Reactivo

export function QuizPlayClient({ quiz }: { quiz: Quiz }) {
  const router = useRouter();
  const {
    phase,
    currentQuestion,
    progress,
    selectedAnswer,
    lastResult,
    error,
    hydrate,
    start,
    selectAnswer,
    submit,
    advance,
    end,
  } = useQuiz();
  // [Inicio de la pregunta]: `useRef` (React) y no estado → solo se lee al responder; cambiarlo no debe re-renderizar | [Principio]: KISS
  const questionStartRef = useRef(0);
  const startedRef = useRef(false);

  // [Hidratar + iniciar sesion]: una sola vez al montar | [Patron]: Effect
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    hydrate(quiz);
    void start(quiz.id);
  }, [quiz, hydrate, start]);

  // [Reset timer marker]: cuando cambia la pregunta | [Patron]: Side-effect controlado
  useEffect(() => {
    questionStartRef.current = Date.now(); // Efecto (fuera del render): mutar un ref aquí es seguro
  }, [currentQuestion?.id]);

  // [Auto-redirect a resultados]: al terminar
  useEffect(() => {
    if (phase === "finished") {
      router.push(`/quiz/${quiz.id}/results`);
    }
  }, [phase, quiz.id, router]);

  if (phase === "loading" || !currentQuestion) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="size-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-destructive">
        {error ?? "Error desconocido"}
      </div>
    );
  }

  const timeLimit =
    currentQuestion.timeLimitSeconds ?? quiz.timePerQuestionSeconds;

  const handleSubmit = async () => {
    if (!selectedAnswer) return;
    const timeTakenMs = Date.now() - questionStartRef.current;
    const ok = await submit({
      questionId: currentQuestion.id,
      userAnswer: selectedAnswer,
      timeTakenMs,
    });
    if (!ok) return;
  };

  const handleExpire = () => {
    if (selectedAnswer) {
      void handleSubmit();
    } else {
      void submit({
        questionId: currentQuestion.id,
        userAnswer: "",
        timeTakenMs: timeLimit * 1000,
      });
    }
  };

  const handleNext = async () => {
    if (progress.current >= progress.total) {
      await end(false);
    } else {
      advance();
    }
  };

  const hasAnswered = lastResult !== null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <QuizProgress current={progress.current} total={progress.total} />
      <TimerBar
        key={currentQuestion.id}
        seconds={timeLimit}
        onExpire={handleExpire}
        isPaused={phase === "paused" || hasAnswered}
      />
      <QuestionCard
        question={currentQuestion}
        selectedAnswer={selectedAnswer}
        isLocked={hasAnswered || phase === "submitting"}
        onSelect={selectAnswer}
      />

      {hasAnswered && lastResult && (
        <div
          role="alert"
          aria-live="polite"
          className={
            lastResult.isCorrect
              ? "rounded-xl border border-success/40 bg-success/10 p-4 text-success font-semibold"
              : "rounded-xl border border-danger/40 bg-danger/10 p-4 text-danger font-semibold"
          }
        >
          {lastResult.isCorrect
            ? `Correcto · +${Math.round(lastResult.score)} puntos`
            : "Incorrecto"}
        </div>
      )}

      <div className="flex justify-end gap-3">
        {!hasAnswered ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedAnswer || phase === "submitting"}
            className="btn btn-primary btn-lg"
          >
            {phase === "submitting" ? "Enviando..." : "Responder"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            className="btn btn-primary btn-lg"
          >
            {progress.current >= progress.total ? "Ver resultados" : "Siguiente →"}
          </button>
        )}
      </div>
    </div>
  );
}
