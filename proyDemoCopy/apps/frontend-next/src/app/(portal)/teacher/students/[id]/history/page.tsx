import { BackLink } from "@/components/shared/BackLink"; // [2026-10-23]: enlace «volver» uniforme (icono + texto)
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getStudent,
  getUserSessionsHistory,
} from "@/lib/quiz-api";
import type { StudentListItem } from "@/lib/quiz-api";
import type {
  Difficulty,
  MyHistoryItem,
  QuestionType,
} from "@/types/quiz";
import { DifficultyBadge } from "@/components/quiz/DifficultyBadge";
import { categoryLabel } from "@/lib/categories";
import { DIFFICULTY_LABEL_ES } from "@/lib/constants";
import { AnalyticsFilters } from "@/components/portal/AnalyticsFilters";
import { parsePeriod, monthsToSince } from "@/lib/period";
// [Página teacher/students/[id]/history]: docente/admin consulta historial de un estudiante específico para seguimiento académico | [Patrón]: Container/Presentational (RSC) | [Principio]: SRP | [Paradigma]: Server Component

export const metadata: Metadata = {
  title: "Historial estudiante",
  description: "Historial del estudiante: puntaje, exámenes realizados y feedback por pregunta.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// [Delegado al SSOT]: etiqueta + banda MCER/CEFR | [Principio]: DRY + SSOT
const DIFFICULTY_LABEL: Readonly<Record<Difficulty, string>> = DIFFICULTY_LABEL_ES;

function fmtDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  multiple_choice: "Opción múltiple",
  true_false: "Verdadero / Falso",
  open_answer: "Respuesta abierta",
};

// [Agrega precisión por clave de sesión]: promedio ponderado por preguntas | [Patrón]: Group-Aggregate
function aggBySession<K extends string>(
  items: MyHistoryItem[],
  keyOf: (s: MyHistoryItem) => K,
): Array<{ key: K; accuracy: number; correct: number; total: number }> {
  const map = new Map<K, { correct: number; total: number }>();
  for (const s of items) {
    const k = keyOf(s);
    const acc = map.get(k) ?? { correct: 0, total: 0 };
    acc.correct += s.correctCount;
    acc.total += s.totalQuestions;
    map.set(k, acc);
  }
  return [...map.entries()].map(([key, v]) => ({
    key,
    accuracy: v.total > 0 ? v.correct / v.total : 0,
    correct: v.correct,
    total: v.total,
  }));
}

// [Análisis/recomendación por examen]: texto derivado de los resultados REALES de la sesión | [Patrón]: Template-from-data
function examRecommendation(item: MyHistoryItem): string[] {
  const pct = Math.round(item.accuracy * 100);
  const lines: string[] = [];
  if (pct >= 90) {
    lines.push(
      `Dominio sólido: ${item.correctCount}/${item.totalQuestions} correctas (${pct}%). El estudiante puede avanzar a mayor dificultad.`,
    );
  } else if (pct >= 70) {
    lines.push(
      `Buen desempeño: ${item.correctCount}/${item.totalQuestions} correctas (${pct}%). Reforzar los puntos fallados para consolidar.`,
    );
  } else if (pct >= 50) {
    lines.push(
      `Desempeño aceptable: ${item.correctCount}/${item.totalQuestions} correctas (${pct}%). Conviene repasar los conceptos del examen.`,
    );
  } else {
    lines.push(
      `Necesita refuerzo: ${item.correctCount}/${item.totalQuestions} correctas (${pct}%). Recomendar repaso desde la base del tema.`,
    );
  }
  const wrongNums = item.answers
    .map((a, i) => ({ a, i }))
    .filter((x) => !x.a.isCorrect)
    .map((x) => x.i + 1);
  if (wrongNums.length > 0) {
    lines.push(
      `Preguntas a reforzar: ${wrongNums.slice(0, 8).join(", ")}. Revisar el feedback emitido en cada una.`,
    );
  } else {
    lines.push("Sin errores en este examen.");
  }
  return lines;
}

// [Agrega precisión por tipo de pregunta]: recorre answers de todas las sesiones | [Patrón]: Group-Aggregate
function aggByType(
  items: MyHistoryItem[],
): Array<{ type: QuestionType; accuracy: number; correct: number; total: number }> {
  const map = new Map<QuestionType, { correct: number; total: number }>();
  for (const s of items) {
    for (const a of s.answers) {
      const acc = map.get(a.questionType) ?? { correct: 0, total: 0 };
      acc.total += 1;
      if (a.isCorrect) acc.correct += 1;
      map.set(a.questionType, acc);
    }
  }
  return [...map.entries()].map(([type, v]) => ({
    type,
    accuracy: v.total > 0 ? v.correct / v.total : 0,
    correct: v.correct,
    total: v.total,
  }));
}

export default async function StudentHistoryPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await props.params;
  if (!id) notFound();
  const sp = await props.searchParams;
  const months = parsePeriod(sp.period);

  let student: StudentListItem | null = null;
  let items: MyHistoryItem[] = [];
  let error: string | null = null;
  try {
    // [Resolución paralela]: alumno + historial en paralelo | [Patrón]: Promise.all
    const [user, history] = await Promise.all([
      getStudent(id).catch(() => null),
      getUserSessionsHistory(id, 100),
    ]);
    student = user;
    // [Filtro de periodo en cliente]: recorta las sesiones a la ventana de meses | [Patrón]: Time Window
    const since = monthsToSince(months);
    items = since
      ? history.filter((h) => new Date(h.startedAt) >= since)
      : history;
  } catch (err) {
    error = err instanceof Error ? err.message : "Error cargando historial";
  }

  const completed = items.filter((i) => i.status === "completed");
  const totalScore = completed.reduce((acc, i) => acc + i.totalScore, 0);
  const totalQuestions = completed.reduce((acc, i) => acc + i.totalQuestions, 0);
  const totalCorrect = completed.reduce((acc, i) => acc + i.correctCount, 0);
  const overallAccuracy = totalQuestions > 0 ? totalCorrect / totalQuestions : 0;

  // [Analítica real para el docente]: agregados por materia, dificultad y tipo + tendencia cronológica | [Patrón]: Group-Aggregate
  const byCategory = aggBySession(items, (s) => s.quizCategory).sort(
    (a, b) => b.accuracy - a.accuracy,
  );
  const difficultyOrder: Difficulty[] = ["easy", "medium", "hard"];
  const byDifficulty = difficultyOrder
    .map((d) => aggBySession(items, (s) => s.quizDifficulty).find((x) => x.key === d))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  const byType = aggByType(items);
  // [Tendencia]: sesiones completadas en orden cronológico ascendente | [Patrón]: Map-Transform
  const trend = [...completed]
    .sort(
      (a, b) =>
        new Date(a.completedAt ?? a.startedAt).getTime() -
        new Date(b.completedAt ?? b.startedAt).getTime(),
    )
    .map((s) => Math.round(s.accuracy * 100));
  const bestScore = completed.length
    ? Math.max(...completed.map((s) => Math.round(s.accuracy * 100)))
    : 0;
  const avgTimeMs =
    completed.length > 0
      ? completed.reduce(
          (sum, s) => sum + s.answers.reduce((t, a) => t + a.timeTakenMs, 0),
          0,
        ) / Math.max(1, totalQuestions)
      : 0;
  const weakest = byCategory.length
    ? byCategory[byCategory.length - 1]
    : null;

  // [Recomendaciones del sistema para el estudiante]: derivadas de materias con menor precisión real | [Patrón]: Data-Driven Recommendation
  const recommendations = [...byCategory]
    .filter((c) => c.accuracy < 0.85)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);
  // [Feedbacks emitidos al estudiante]: preguntas falladas con feedback pedagógico almacenado | [Patrón]: Flatten-Filter
  const issuedFeedbacks = items
    .flatMap((s) =>
      s.answers
        .filter((a) => !a.isCorrect && (a.feedback || a.explanation))
        .map((a) => ({ quiz: s.quizTitle, ...a })),
    )
    .slice(0, 12);

  return (
    <div className="w-full space-y-5 py-4">
      <nav aria-label="Migas de pan" className="text-xs text-muted-foreground">
        <BackLink href="/teacher/students" memo="students">Volver a estudiantes</BackLink>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {student
              ? `${student.firstName} ${student.lastName}`
              : "Historial del estudiante"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {student ? student.email : "Seguimiento del estudiante"}
          </p>
        </div>
        <AnalyticsFilters />
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <section
        aria-label="Resumen de progreso"
        className="grid gap-4 sm:grid-cols-4"
      >
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Exámenes completados</p>
          <p className="mt-1 text-2xl font-extrabold">{completed.length}</p>
        </article>
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Puntaje total</p>
          <p className="mt-1 text-2xl font-extrabold">{totalScore.toFixed(0)}</p>
        </article>
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Respuestas correctas</p>
          <p className="mt-1 text-2xl font-extrabold">
            {totalCorrect} / {totalQuestions}
          </p>
        </article>
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Precisión global</p>
          <p className="mt-1 text-2xl font-extrabold">
            {(overallAccuracy * 100).toFixed(1)}%
          </p>
        </article>
      </section>

      {/* [Analítica del docente — datos reales agregados] */}
      {items.length > 0 && (
        <>
          <section className="grid gap-4 sm:grid-cols-3" aria-label="Métricas adicionales">
            <article className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Mejor puntaje (examen)</p>
              <p className="mt-1 text-2xl font-extrabold">{bestScore}%</p>
            </article>
            <article className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Tiempo medio / pregunta</p>
              <p className="mt-1 text-2xl font-extrabold">
                {(avgTimeMs / 1000).toFixed(1)}
                <span className="text-base text-muted-foreground">s</span>
              </p>
            </article>
            <article className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Competencia más débil</p>
              <p className="mt-1 text-lg font-extrabold">
                {weakest ? categoryLabel(weakest.key) : "—"}
                {weakest && (
                  <span className="ml-1 text-sm text-tone-warning">
                    {Math.round(weakest.accuracy * 100)}%
                  </span>
                )}
              </p>
            </article>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            {/* [Precisión por materia] */}
            <div className="rounded-xl border bg-card p-5">
              <h2 className="text-lg font-bold mb-3">Precisión por competencia</h2>
              <div className="flex flex-col gap-3">
                {byCategory.map((c) => {
                  const pct = Math.round(c.accuracy * 100);
                  return (
                    <div key={c.key} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-sm">
                        {categoryLabel(c.key)}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-brand"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <b className="w-16 text-right text-sm tabular-nums">
                        {pct}% ({c.total})
                      </b>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* [Precisión por dificultad] */}
            <div className="rounded-xl border bg-card p-5">
              <h2 className="text-lg font-bold mb-3">Precisión por dificultad</h2>
              <div className="flex flex-col gap-3">
                {byDifficulty.map((d) => {
                  const pct = Math.round(d.accuracy * 100);
                  return (
                    <div key={d.key} className="flex items-center gap-3">
                      <span className="w-20 shrink-0 text-sm">
                        {DIFFICULTY_LABEL[d.key]}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-brand"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <b className="w-16 text-right text-sm tabular-nums">
                        {pct}% ({d.total})
                      </b>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            {/* [Precisión por tipo de pregunta] */}
            <div className="rounded-xl border bg-card p-5">
              <h2 className="text-lg font-bold mb-3">Precisión por tipo de pregunta</h2>
              <div className="flex flex-col gap-3">
                {byType.map((t) => {
                  const pct = Math.round(t.accuracy * 100);
                  return (
                    <div key={t.type} className="flex items-center gap-3">
                      <span className="w-32 shrink-0 text-sm">
                        {QUESTION_TYPE_LABEL[t.type]}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-brand"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <b className="w-16 text-right text-sm tabular-nums">
                        {pct}% ({t.total})
                      </b>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* [Tendencia de precisión por examen — sparkline en barras] */}
            <div className="rounded-xl border bg-card p-5">
              <h2 className="text-lg font-bold mb-3">Evolución por examen</h2>
              {trend.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Sin exámenes completados.
                </p>
              ) : (
                <div className="flex items-end gap-2 h-40">
                  {trend.map((v, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end h-32">
                        <div
                          className="w-full rounded-t bg-gradient-brand"
                          style={{ height: `${Math.max(4, v)}%` }}
                          title={`Examen ${i + 1}: ${v}%`}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{v}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* [Recomendaciones que el sistema le hizo al estudiante] */}
          {recommendations.length > 0 && (
            <section className="rounded-xl border bg-card p-5">
              <h2 className="text-lg font-bold mb-1">Recomendaciones del sistema al estudiante</h2>
              <p className="text-xs text-muted-foreground mb-3">
                Áreas sugeridas a reforzar, derivadas de su menor precisión por competencia.
              </p>
              <div className="flex flex-col gap-2">
                {recommendations.map((r) => (
                  <div
                    key={r.key}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div>
                      <b className="text-sm">Reforzar {categoryLabel(r.key)}</b>
                      <p className="text-xs text-muted-foreground">
                        Precisión actual {Math.round(r.accuracy * 100)}% ({r.correct}/{r.total} correctas).
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-tone-warning-soft px-2.5 py-0.5 text-xs font-semibold text-tone-warning">
                      {Math.round(r.accuracy * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* [Feedback pedagógico entregado al estudiante en preguntas falladas] */}
          {issuedFeedbacks.length > 0 && (
            <section className="rounded-xl border bg-card p-5">
              <h2 className="text-lg font-bold mb-1">Feedback entregado por la IA</h2>
              <p className="text-xs text-muted-foreground mb-3">
                Retroalimentación que recibió el estudiante en las preguntas falladas.
              </p>
              <ul className="space-y-2">
                {issuedFeedbacks.map((f, i) => (
                  <li key={f.questionId + i} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">{f.questionText}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {f.quiz} · Respondió: {f.userAnswer || "(vacía)"} · Correcta: {f.correctAnswer}
                    </p>
                    {f.feedback && (
                      <p className="mt-1.5 rounded-md bg-primary/5 px-2 py-1 text-xs">
                        <span className="font-semibold">Feedback: </span>
                        {f.feedback}
                      </p>
                    )}
                    {f.explanation && (
                      <p className="mt-1 rounded-md bg-muted/40 px-2 py-1 text-xs">
                        <span className="font-semibold">Explicación: </span>
                        {f.explanation}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          El estudiante aún no ha realizado exámenes.
        </div>
      ) : (
        <section className="space-y-4" aria-label="Lista de sesiones">
          {items.map((item) => (
            <article
              key={item.sessionId}
              className="rounded-xl border bg-card p-5 space-y-4"
            >
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold">{item.quizTitle}</h2>
                    <DifficultyBadge difficulty={item.quizDifficulty} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {categoryLabel(item.quizCategory)} ·{" "}
                    {DIFFICULTY_LABEL[item.quizDifficulty]} · Iniciado{" "}
                    {fmtDate(item.startedAt)} · Finalizado{" "}
                    {fmtDate(item.completedAt)}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p>
                    <span className="font-bold text-primary">
                      {item.totalScore.toFixed(0)}
                    </span>{" "}
                    puntos
                  </p>
                  <p className="text-muted-foreground">
                    {item.correctCount} / {item.totalQuestions} correctas ·{" "}
                    {(item.accuracy * 100).toFixed(0)}%
                  </p>
                  <p
                    className={
                      item.status === "completed"
                        ? "text-xs font-semibold text-tone-brand"
                        : item.status === "abandoned"
                          ? "text-xs font-semibold text-tone-warning"
                          : "text-xs font-semibold text-tone-info"
                    }
                  >
                    {item.status === "completed"
                      ? "Completado"
                      : item.status === "abandoned"
                        ? "Abandonado"
                        : "En curso"}
                  </p>
                </div>
              </header>

              {/* [Recomendación del sistema para ESTE examen — derivada de datos reales] */}
              <div className="rounded-lg border border-primary/15 bg-primary/5 p-4 text-sm space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-primary">
                  <span className="grid place-items-center size-5 rounded bg-gradient-brand text-white text-[10px]">
                    IA
                  </span>
                  Recomendación del sistema
                </div>
                {examRecommendation(item).map((line, i) => (
                  <p key={i} className="text-foreground">
                    {line}
                  </p>
                ))}
              </div>

              <details className="rounded-lg border bg-background">
                <summary className="cursor-pointer select-none px-4 py-2 text-sm font-semibold hover:bg-muted/30">
                  Ver detalle por pregunta ({item.answers.length})
                </summary>
                <ol className="divide-y">
                  {item.answers.map((a, idx) => (
                    <li
                      key={a.questionId + idx}
                      className="px-4 py-3 space-y-2"
                      aria-label={`Pregunta ${idx + 1}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium">
                          {idx + 1}. {a.questionText}
                        </p>
                        <span
                          className={
                            a.isCorrect
                              ? "shrink-0 rounded-full bg-tone-brand-soft px-2 py-0.5 text-[11px] font-semibold text-tone-brand"
                              : "shrink-0 rounded-full bg-tone-danger-soft px-2 py-0.5 text-[11px] font-semibold text-tone-danger"
                          }
                        >
                          {a.isCorrect ? "Correcta" : "Incorrecta"}
                        </span>
                      </div>
                      <dl className="grid gap-1 text-xs sm:grid-cols-2">
                        <div>
                          <dt className="text-muted-foreground">Respuesta del estudiante</dt>
                          <dd
                            className={
                              a.isCorrect ? "text-tone-brand" : "text-tone-danger"
                            }
                          >
                            {a.userAnswer || "(sin respuesta)"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Respuesta correcta</dt>
                          <dd className="text-foreground">{a.correctAnswer}</dd>
                        </div>
                      </dl>
                      {/* [Explicación + feedback por pregunta]: siempre visibles para el docente | [Principio]: Transparencia académica */}
                      <p className="rounded-md bg-muted/40 px-3 py-2 text-xs">
                        <span className="font-semibold">Explicación: </span>
                        {a.explanation || "Sin explicación registrada."}
                      </p>
                      <p className="rounded-md bg-primary/5 px-3 py-2 text-xs">
                        <span className="font-semibold">Feedback pedagógico: </span>
                        {a.feedback || "Sin feedback registrado."}
                      </p>
                    </li>
                  ))}
                </ol>
              </details>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
