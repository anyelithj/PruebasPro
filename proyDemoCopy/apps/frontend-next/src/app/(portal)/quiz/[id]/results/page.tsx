"use client";
import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { selectFeedbacks } from "@/store/slices/quizSlice";
import { ScoreDisplay } from "@/components/quiz/ScoreDisplay";
import { FeedbackPanel } from "@/components/ai/FeedbackPanel";
import { WeaknessChart, type WeakTopicDatum } from "@/components/ai/WeaknessChart";
import { labelCategory, labelDifficulty } from "@/lib/constants";
// [QuizResultsPage]: integra ScoreDisplay + FeedbackPanel + WeaknessChart | [Patron]: Container | [Principio]: SRP | [Paradigma]: Funcional + Reactivo
// [Nota Sprint 2.3]: lectura del store en cliente. Si user refresca, no hay resultado en memoria — redirige a /dashboard.

// [Calcula accuracy por dificultad]: análisis local sin llamada a FastAPI | [Patrón]: Map-Reduce | [Principio]: SRP
function computeAccuracyByDifficulty(
  answers: Array<{ questionId: string; isCorrect: boolean }>,
  questions: Array<{ id: string; difficulty: string }>,
): Record<string, number> {
  const buckets: Record<string, { correct: number; total: number }> = {};
  for (const a of answers) {
    const q = questions.find((qq) => qq.id === a.questionId);
    if (!q) continue;
    if (!buckets[q.difficulty]) buckets[q.difficulty] = { correct: 0, total: 0 };
    buckets[q.difficulty].total += 1;
    if (a.isCorrect) buckets[q.difficulty].correct += 1;
  }
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(buckets)) {
    result[k] = v.total > 0 ? v.correct / v.total : 0;
  }
  return result;
}

const THRESHOLD = 0.6;

export default function QuizResultsPage() {
  const router = useRouter();
  const session = useSelector((s: RootState) => s.quiz.session);
  const quiz = useSelector((s: RootState) => s.quiz.quiz);
  const feedbacks = useSelector(selectFeedbacks);

  useEffect(() => {
    if (!session || !quiz) {
      router.replace("/dashboard");
    }
  }, [session, quiz, router]);

  // [Análisis local de debilidades]: por dificultad de pregunta y por categoría global | [Patrón]: Strategy local
  const weakTopics: WeakTopicDatum[] = useMemo(() => {
    if (!session || !quiz?.questions) return [];
    const byDifficulty = computeAccuracyByDifficulty(session.answers, quiz.questions);
    const datums: WeakTopicDatum[] = Object.entries(byDifficulty).map(([difficulty, acc]) => ({
      topic: `${labelCategory(quiz.category)} · ${labelDifficulty(difficulty)}`,
      accuracy: acc,
      recommendation:
        acc < THRESHOLD * 0.5
          ? "Necesitas reforzar los fundamentos en este nivel."
          : acc < THRESHOLD
            ? "Practica más preguntas en este nivel para consolidar."
            : "Buen dominio en este nivel.",
    }));
    return datums.filter((d) => d.accuracy < THRESHOLD);
  }, [session, quiz]);

  const strongTopics: string[] = useMemo(() => {
    if (!session || !quiz?.questions) return [];
    const byDifficulty = computeAccuracyByDifficulty(session.answers, quiz.questions);
    return Object.entries(byDifficulty)
      .filter(([, acc]) => acc >= 0.8)
      .map(([d]) => `${labelCategory(quiz.category)} · ${labelDifficulty(d)}`);
  }, [session, quiz]);

  if (!session || !quiz) return null;

  return (
    <div className="w-full space-y-5 py-4">
      <header className="text-center">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Resultados — {quiz.title}</h1>
      </header>

      <ScoreDisplay
        points={session.totalScore}
        correctCount={session.correctCount}
        totalQuestions={quiz.questions?.length ?? 0}
      />

      <FeedbackPanel
        answers={session.answers}
        questions={quiz.questions ?? []}
        feedbacks={feedbacks}
      />

      <WeaknessChart
        weakTopics={weakTopics}
        strongTopics={strongTopics}
        threshold={THRESHOLD}
      />

      <div className="flex flex-wrap gap-3 justify-center">
        <Link
          href={`/quiz/${quiz.id}`}
          className="btn btn-outline"
        >
          Repetir quiz
        </Link>
        <Link
          href="/quiz"
          className="btn btn-primary"
        >
          Otros quizzes
        </Link>
      </div>
    </div>
  );
}
