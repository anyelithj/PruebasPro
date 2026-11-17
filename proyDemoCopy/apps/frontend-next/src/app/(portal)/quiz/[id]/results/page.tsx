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
import { isExamKind } from "@/types/quiz";
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
  const exam = isExamKind(quiz.kind); // [2026-11-06]: examen final/de nivel → aprobado o no + siguiente paso (sin respuestas correctas)
  const examHref = quiz.kind === "final" && quiz.courseId ? `/quiz/examen/curso/${quiz.courseId}` : `/quiz/examen/nivel?language=${quiz.language ?? "en"}&level=${quiz.cefrLevel ?? "A1"}`;

  return (
    <div className="w-full space-y-5 py-4">
      <header className="text-center">
        <h1 className="title-page">Resultados — {quiz.title}</h1>
      </header>

      {exam && (
        <section
          role="status"
          className={`space-y-2 rounded-2xl border p-5 text-center ${session.passed ? "border-success/40 bg-success/10" : "border-danger/40 bg-danger/10"}`}
        >
          <p className="text-5xl font-extrabold">{session.percent ?? 0} %</p>
          <p className={`text-lg font-bold ${session.passed ? "text-success" : "text-danger"}`}>
            {session.passed ? "¡Aprobado! Tu certificado ya se está emitiendo." : `No aprobado · necesitas ${quiz.passScore ?? 70} %`}
          </p>
          <p className="type-meta text-muted-foreground">
            {session.passed
              ? "Lo encontrarás en Mis certificados en unos segundos."
              : "Repasa los temas del curso y vuelve a intentarlo cuando se abra tu próximo intento."}
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-1">
            {session.passed ? (
              <a href="/certificados" className="btn btn-primary">Ver mis certificados</a>
            ) : (
              <Link href={examHref} className="btn btn-primary">Ver intentos</Link>
            )}
          </div>
        </section>
      )}

      <ScoreDisplay
        points={session.totalScore}
        correctCount={session.correctCount}
        totalQuestions={quiz.questions?.length ?? 0}
      />

      {!exam && (
        <FeedbackPanel
          answers={session.answers}
          questions={quiz.questions ?? []}
          feedbacks={feedbacks}
        />
      )}

      <WeaknessChart
        weakTopics={weakTopics}
        strongTopics={strongTopics}
        threshold={THRESHOLD}
      />

      {!exam && <div className="flex flex-wrap gap-3 justify-center">
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
      </div>}
    </div>
  );
}
