import { BackLink } from "@/components/shared/BackLink"; // [2026-10-23]: enlace «volver» uniforme (icono + texto)
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuiz } from "@/lib/quiz-api";
import { CategoryIcon } from "@/components/quiz/CategoryIcon";
import { DifficultyBadge } from "@/components/quiz/DifficultyBadge";
import { getCurrentUserRole } from "@/lib/auth";
import { Role, labelDifficulty } from "@/lib/constants";
// [QuizDetailPage]: SSR detail rol-aware — alumno ve "Comenzar", docente/admin ve preguntas + Editar | [Patron]: Container | [Principio]: SRP | [Paradigma]: RSC + async

export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await props.params;
  try {
    const quiz = await getQuiz(id);
    return {
      title: quiz.title,
      description: quiz.description ?? `Quiz de ${quiz.category}`,
      robots: { index: false, follow: false },
    };
  } catch {
    return { title: "Quiz" };
  }
}

export default async function QuizDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  let quiz;
  try {
    quiz = await getQuiz(id);
  } catch {
    notFound();
  }

  const role = await getCurrentUserRole();
  const isManager = role === Role.TEACHER || role === Role.ADMIN;
  const questionCount = quiz.questions?.length ?? 0;
  const estimatedMinutes = Math.ceil(
    (questionCount * quiz.timePerQuestionSeconds) / 60,
  );

  return (
    <div className="w-full space-y-5 py-4">
      <BackLink href="/quiz" memo="exams">Volver a exámenes</BackLink>

      <header className="rounded-2xl border border-border bg-card p-8">
        <div className="flex items-start gap-4 mb-4">
          <span className="grid place-items-center size-16 rounded-2xl bg-gradient-soft text-4xl">
            <CategoryIcon category={quiz.category} />
          </span>
          <div className="flex-1">
            <div className="mb-2">
              <DifficultyBadge difficulty={quiz.difficulty} />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{quiz.title}</h1>
            {quiz.description && (
              <p className="mt-2 text-muted-foreground">{quiz.description}</p>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border text-center">
          <div>
            <dt className="text-xs text-muted-foreground">Preguntas</dt>
            <dd className="text-2xl font-bold">{questionCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Tiempo/preg.</dt>
            <dd className="text-2xl font-bold">{quiz.timePerQuestionSeconds}s</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Duración aprox.</dt>
            <dd className="text-2xl font-bold">{estimatedMinutes}min</dd>
          </div>
        </dl>
      </header>

      {/* [Botones acción]: Iniciar para todos; Editar solo manager | [Patrón]: Role-based Render */}
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/quiz/${quiz.id}/play`}
          className="flex-1 min-w-[200px] text-center py-3 rounded-xl bg-gradient-brand text-white font-bold text-base hover:opacity-90"
        >
          ▶ Iniciar examen
        </Link>
        {isManager && (
          <Link
            href={`/quiz/${quiz.id}/edit`}
            className="flex-1 min-w-[200px] text-center py-3 rounded-xl border border-primary/40 text-primary font-bold text-base hover:bg-primary/5"
          >
            ✎ Editar examen
          </Link>
        )}
      </div>

      {isManager ? (
        <>
          {/* [Vista docente/admin]: preguntas para revisión | [Principio]: Least Privilege */}
          <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <header className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Preguntas del examen</h2>
            </header>
            {questionCount === 0 ? (
              <p className="text-sm text-muted-foreground">Este examen no tiene preguntas.</p>
            ) : (
              <ol className="space-y-3">
                {quiz.questions?.map((q, idx) => (
                  <li key={q.id} className="rounded-xl border border-border p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold flex-1">
                        {idx + 1}. {q.text}
                      </p>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                        {labelDifficulty(q.difficulty)}
                      </span>
                    </div>
                    {q.options && q.options.length > 0 && (
                      <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">
                        {q.options.map((opt, i) => (
                          <li key={i}>{opt}</li>
                        ))}
                      </ul>
                    )}
                    <p className="text-xs">
                      <span className="font-semibold text-tone-brand">Respuesta correcta: </span>
                      <span className="font-mono">
                        {(q as { correctAnswer?: string }).correctAnswer ?? "—"}
                      </span>
                    </p>
                    {q.explanation && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Explicación: </span>
                        {q.explanation}
                      </p>
                    )}
                    {q.feedback && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Feedback pedagógico: </span>
                        {q.feedback}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
