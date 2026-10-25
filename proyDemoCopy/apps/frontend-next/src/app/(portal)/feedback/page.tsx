import type { Metadata } from "next";
import Link from "next/link";
import { getMySessionsHistory } from "@/lib/quiz-api";
import type { Difficulty, MyHistoryItem, QuestionType } from "@/types/quiz";
import { categoryLabel } from "@/lib/categories";
import { DIFFICULTY_LABEL_ES } from "@/lib/constants";
import { BRAND } from "@/config/brand";
import { getStudyPlan } from "@/lib/ai-api"; // [Sprint 5.2]: debilidades + plan de estudio (NestJS → FastAPI)
import { WeaknessChart } from "@/components/ai/WeaknessChart"; // [DRY]: el mismo gráfico de la pantalla de resultados
import { StudyPlan } from "@/components/ai/StudyPlan";
// [Página Feedback IA del estudiante]: resumen de exámenes resueltos + tabla de detalle por pregunta con feedback pedagógico | [Patrón]: Container/Presentational (RSC) | [Principio]: SRP | [Paradigma]: Server Component

export const metadata: Metadata = {
  title: "Feedback IA",
  description: "Retroalimentación personalizada de tus evaluaciones con detalle por pregunta.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// [Delegado al SSOT]: etiqueta + banda MCER/CEFR | [Principio]: DRY + SSOT
const DIFFICULTY_LABEL: Readonly<Record<Difficulty, string>> = DIFFICULTY_LABEL_ES;

function fmtDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es", {
      year: "numeric",
      month: "long",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

// [Tono por puntaje]: clasifica el desempeño para el badge | [Patrón]: Pure Function
function scoreTone(accuracy: number): { label: string; cls: string } {
  if (accuracy >= 0.9) return { label: "Excelente", cls: "bg-tone-brand-soft text-tone-brand" };
  if (accuracy >= 0.7) return { label: "Bueno", cls: "bg-tone-info-soft text-tone-info" };
  if (accuracy >= 0.5) return { label: "Aceptable", cls: "bg-tone-warning-soft text-tone-warning" };
  return { label: "A reforzar", cls: "bg-tone-danger-soft text-tone-danger" };
}

const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  multiple_choice: "Opción múltiple",
  true_false: "Verdadero / Falso",
  open_answer: "Respuesta abierta",
};

// [Desglose por tipo de pregunta]: precisión real agrupada por tipo dentro del examen | [Patrón]: Group-Aggregate
function breakdownByType(
  item: MyHistoryItem,
): Array<{ type: QuestionType; accuracy: number; correct: number; total: number }> {
  const map = new Map<QuestionType, { correct: number; total: number }>();
  for (const a of item.answers) {
    const acc = map.get(a.questionType) ?? { correct: 0, total: 0 };
    acc.total += 1;
    if (a.isCorrect) acc.correct += 1;
    map.set(a.questionType, acc);
  }
  return [...map.entries()].map(([type, v]) => ({
    type,
    accuracy: v.total > 0 ? v.correct / v.total : 0,
    correct: v.correct,
    total: v.total,
  }));
}

// [Análisis cognitivo derivado]: texto generado a partir de los resultados REALES del examen | [Patrón]: Template-from-data
function cognitiveAnalysis(item: MyHistoryItem): string[] {
  const pct = Math.round(item.accuracy * 100);
  const lines: string[] = [];
  if (pct >= 90) {
    lines.push(
      `Excelente desempeño. Resolviste correctamente ${item.correctCount} de ${item.totalQuestions} preguntas (${pct}%), demostrando un dominio sólido del tema.`,
    );
  } else if (pct >= 70) {
    lines.push(
      `Buen trabajo. Acertaste ${item.correctCount} de ${item.totalQuestions} preguntas (${pct}%). Vas por buen camino, con algunos puntos a pulir.`,
    );
  } else if (pct >= 50) {
    lines.push(
      `Desempeño aceptable: ${item.correctCount} de ${item.totalQuestions} correctas (${pct}%). Conviene repasar los conceptos clave del tema.`,
    );
  } else {
    lines.push(
      `Necesitas reforzar este tema: ${item.correctCount} de ${item.totalQuestions} correctas (${pct}%). Te recomendamos repasarlo desde la base.`,
    );
  }
  const wrong = item.answers.filter((a) => !a.isCorrect);
  if (wrong.length > 0) {
    const nums = item.answers
      .map((a, i) => ({ a, i }))
      .filter((x) => !x.a.isCorrect)
      .map((x) => x.i + 1)
      .slice(0, 6);
    lines.push(
      `Áreas a reforzar: revisa las preguntas ${nums.join(", ")} y su feedback para corregir los conceptos fallados.`,
    );
  } else {
    lines.push(
      "Recomendación: no tuviste errores. Continúa con un examen de mayor dificultad para seguir avanzando.",
    );
  }
  return lines;
}

// [accuracyByCategory]: precisión por categoría sobre los exámenes completados → entrada del análisis de debilidades | función pura
function accuracyByCategory(items: MyHistoryItem[]): Record<string, number> {
  const acc = new Map<string, { correct: number; total: number }>(); // `Map` (ES2015): acumulador por categoría
  for (const i of items) {
    const key = categoryLabel(i.quizCategory);
    const prev = acc.get(key) ?? { correct: 0, total: 0 };
    acc.set(key, { correct: prev.correct + i.correctCount, total: prev.total + i.totalQuestions });
  }
  // `Object.fromEntries` (ES2019): Map → objeto JSON para la API
  return Object.fromEntries([...acc].filter(([, v]) => v.total > 0).map(([k, v]) => [k, v.correct / v.total]));
}

export default async function FeedbackPage() {
  let items: MyHistoryItem[] = [];
  let error: string | null = null;
  try {
    items = await getMySessionsHistory(50);
  } catch (err) {
    error = err instanceof Error ? err.message : "No se pudo cargar el feedback";
  }

  const completed = items.filter((i) => i.status === "completed");
  // [Plan de estudio]: solo con exámenes completados | `.catch(() => null)`: sin IA la página sigue mostrando el historial
  const studyPlan = completed.length ? await getStudyPlan(accuracyByCategory(completed)).catch(() => null) : null;

  return (
    <div className="w-full space-y-5 py-4">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Feedback generado por IA</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Retroalimentación personalizada de tus evaluaciones. Revisa el detalle por
          pregunta para identificar qué reforzar.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {/* [Sprint 5.2]: temas débiles y plan ordenado (FeedbackEngine de FastAPI vía la puerta de IA de NestJS) */}
      {completed.length > 0 && (
        <section aria-labelledby="plan-title" className="surface space-y-4 p-5">
          <div>
            <h2 id="plan-title" className="text-xl font-bold">
              Tu plan de estudio
            </h2>
            <p className="text-sm text-muted-foreground">Calculado con tu precisión por categoría en {completed.length} examen(es) completado(s).</p>
          </div>
          {studyPlan ? (
            <>
              <WeaknessChart weakTopics={studyPlan.weaknesses.weak_topics} strongTopics={studyPlan.weaknesses.strong_topics} />
              {studyPlan.plan?.plan.length ? (
                <StudyPlan steps={studyPlan.plan.plan} totalMinutes={studyPlan.plan.total_minutes} />
              ) : (
                <p className="text-sm text-muted-foreground">No tienes temas por debajo del 60 %: sigue con exámenes de mayor dificultad.</p>
              )}
            </>
          ) : (
            <p role="status" className="text-sm text-muted-foreground">
              El análisis con IA no está disponible en este momento. Tu historial sigue abajo.
            </p>
          )}
        </section>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center space-y-3">
          <h2 className="text-xl font-bold">Aún no hay evaluaciones</h2>
          <p className="text-sm text-muted-foreground">
            Cuando completes un examen verás aquí el análisis y el feedback por pregunta.
          </p>
          <Link
            href="/quiz"
            className="btn btn-primary"
          >
            Ir a Exámenes
          </Link>
        </div>
      ) : (
        <section className="space-y-4" aria-label="Historial de exámenes con feedback">
          {items.map((item) => {
            const tone = scoreTone(item.accuracy);
            const incorrect = item.answers.filter((a) => !a.isCorrect);
            const analysis = cognitiveAnalysis(item);
            const typeBreakdown = breakdownByType(item);
            return (
              <article
                key={item.sessionId}
                className="rounded-xl border bg-card p-5 space-y-4"
              >
                {/* [Resumen del examen] */}
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">{item.quizTitle}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {fmtDate(item.completedAt ?? item.startedAt)} ·{" "}
                      {categoryLabel(item.quizCategory)} ·{" "}
                      {DIFFICULTY_LABEL[item.quizDifficulty]}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-extrabold text-primary leading-none">
                      {Math.round(item.accuracy * 100)}
                      <span className="text-base text-muted-foreground">/100</span>
                    </div>
                    <span
                      className={`inline-block mt-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone.cls}`}
                    >
                      {tone.label}
                    </span>
                  </div>
                </header>

                {/* [Análisis cognitivo IA — derivado de datos reales] */}
                <div className="rounded-lg border border-primary/15 bg-primary/5 p-4 text-sm space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-primary">
                    <span className="grid place-items-center size-5 rounded bg-gradient-brand text-white text-[10px]">
                      IA
                    </span>
                    {BRAND.name} — Análisis de errores
                  </div>
                  {analysis.map((line, i) => (
                    <p key={i} className="text-foreground">
                      {line}
                    </p>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Puntaje total: <b>{item.totalScore.toFixed(0)}</b> puntos ·{" "}
                    {incorrect.length} incorrecta{incorrect.length === 1 ? "" : "s"}.
                  </p>
                </div>

                {/* [Desglose por tema — precisión real por tipo de pregunta] */}
                {typeBreakdown.length > 0 && (
                  <div className="space-y-2.5">
                    <h3 className="text-sm font-semibold">Desglose por tema</h3>
                    {typeBreakdown.map((t) => {
                      const pct = Math.round(t.accuracy * 100);
                      return (
                        <div key={t.type}>
                          <div className="flex justify-between text-xs mb-1">
                            <span>{QUESTION_TYPE_LABEL[t.type]}</span>
                            <b
                              className={
                                pct >= 85
                                  ? "text-tone-brand"
                                  : pct >= 60
                                    ? "text-foreground"
                                    : "text-tone-warning"
                              }
                            >
                              {pct}% ({t.correct}/{t.total})
                            </b>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-brand"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* [Tabla detalle por pregunta] */}
                <details className="rounded-lg border bg-background">
                  <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-semibold hover:bg-muted/30">
                    Ver detalle por pregunta ({item.answers.length})
                  </summary>
                  <div className="overflow-x-auto px-4 pb-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b">
                          <th className="py-2 pr-3 font-semibold">#</th>
                          <th className="py-2 pr-3 font-semibold">Pregunta</th>
                          <th className="py-2 pr-3 font-semibold">Tu respuesta</th>
                          <th className="py-2 pr-3 font-semibold">Correcta</th>
                          <th className="py-2 pr-3 font-semibold text-center">Resultado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.answers.map((a, idx) => (
                          <tr
                            key={a.questionId + idx}
                            className="border-b last:border-0 align-top"
                          >
                            <td className="py-2 pr-3 text-muted-foreground">{idx + 1}</td>
                            <td className="py-2 pr-3">
                              <p className="font-medium">{a.questionText}</p>
                              {!a.isCorrect && a.feedback && (
                                <p className="mt-1 rounded-md bg-primary/5 px-2 py-1 text-xs text-foreground">
                                  <span className="font-semibold">Feedback: </span>
                                  {a.feedback}
                                </p>
                              )}
                              {!a.isCorrect && a.explanation && (
                                <p className="mt-1 rounded-md bg-muted/40 px-2 py-1 text-xs">
                                  <span className="font-semibold">Explicación: </span>
                                  {a.explanation}
                                </p>
                              )}
                            </td>
                            <td
                              className={`py-2 pr-3 ${a.isCorrect ? "text-tone-brand" : "text-tone-danger"}`}
                            >
                              {a.userAnswer || "(vacía)"}
                            </td>
                            <td className="py-2 pr-3">{a.correctAnswer}</td>
                            <td className="py-2 pr-3 text-center">
                              {a.isCorrect ? (
                                <span className="rounded-full bg-tone-brand-soft px-2 py-0.5 text-xs font-semibold text-tone-brand">
                                  ✓
                                </span>
                              ) : (
                                <span className="rounded-full bg-tone-danger-soft px-2 py-0.5 text-xs font-semibold text-tone-danger">
                                  ✗
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </article>
            );
          })}
        </section>
      )}

      {completed.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {completed.length} {completed.length === 1 ? "examen" : "exámenes"} {completed.length === 1 ? "completado" : "completados"}
          {completed.length === 1 ? "" : "s"}.
        </p>
      )}
    </div>
  );
}
