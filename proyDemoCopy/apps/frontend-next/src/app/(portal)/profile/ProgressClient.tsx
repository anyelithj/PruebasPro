"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  Difficulty,
  MyHistoryItem,
  ScoreEntry,
} from "@/types/quiz";
import { categoryLabel } from "@/lib/categories";
import { DIFFICULTY_LABEL_ES } from "@/lib/constants";
// [ProgressClient]: visualiza historial + tendencia + stats + distribución por materia + habilidades + recomendaciones | [Patron]: Presentational | [Principio]: SRP | [Paradigma]: Funcional + Reactivo
// [Sin leaderboard]: el ranking expone datos de otros estudiantes; ahora es exclusivo del docente | [Principio]: Least Privilege

export interface ProgressClientProps {
  history: ScoreEntry[];
  // [sessions]: historial detallado con categoría/dificultad para agregados reales por materia | [Principio]: SSOT
  sessions: MyHistoryItem[];
  error: string | null;
}

// [Delegado al SSOT]: etiqueta + banda MCER/CEFR | [Principio]: DRY + SSOT
const DIFFICULTY_LABEL: Readonly<Record<Difficulty, string>> = DIFFICULTY_LABEL_ES;

// [Agrega precisión por clave]: promedio ponderado por preguntas | [Patrón]: Group-Aggregate | [Principio]: SRP
function aggregateAccuracy<K extends string>(
  sessions: MyHistoryItem[],
  keyOf: (s: MyHistoryItem) => K,
): Array<{ key: K; accuracy: number; correct: number; total: number }> {
  const map = new Map<K, { correct: number; total: number }>();
  for (const s of sessions) {
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

// [Stats agregadas]: pura derivación del historial | [Principio]: SRP
function computeStats(history: ScoreEntry[]) {
  if (history.length === 0) {
    return {
      totalQuizzes: 0,
      totalPoints: 0,
      avgAccuracy: 0,
      bestAccuracy: 0,
    };
  }
  const totalPoints = history.reduce((sum, h) => sum + h.points, 0);
  const avgAccuracy =
    history.reduce((sum, h) => sum + h.accuracy, 0) / history.length;
  const bestAccuracy = Math.max(...history.map((h) => h.accuracy));
  return {
    totalQuizzes: history.length,
    totalPoints,
    avgAccuracy,
    bestAccuracy,
  };
}

export function ProgressClient({ history, sessions, error }: ProgressClientProps) {
  const stats = useMemo(() => computeStats(history), [history]);

  // [Paginación historial]: 5 filas/página en cliente | [Patrón]: Client Paging
  const HIST_PAGE_SIZE = 5;
  const [histPage, setHistPage] = useState(1);
  const histTotalPages = Math.max(1, Math.ceil(history.length / HIST_PAGE_SIZE));
  const histRows = history.slice(
    (histPage - 1) * HIST_PAGE_SIZE,
    histPage * HIST_PAGE_SIZE,
  );

  // [Distribución por materia]: precisión real por categoría del quiz | [Patrón]: Group-Aggregate
  const byCategory = useMemo(
    () =>
      aggregateAccuracy(sessions, (s) => s.quizCategory)
        .sort((a, b) => b.accuracy - a.accuracy),
    [sessions],
  );

  // [Habilidades por dificultad]: precisión real por nivel de dificultad (proxy de habilidad cognitiva con datos reales) | [Patrón]: Group-Aggregate
  const byDifficulty = useMemo(() => {
    const order: Difficulty[] = ["easy", "medium", "hard"];
    const agg = aggregateAccuracy(sessions, (s) => s.quizDifficulty);
    return order
      .map((d) => agg.find((a) => a.key === d))
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [sessions]);

  // [Precisión global real]: para el donut de materias | [Patrón]: Derived
  const overallAccuracy = useMemo(() => {
    const total = sessions.reduce((s, x) => s + x.totalQuestions, 0);
    const correct = sessions.reduce((s, x) => s + x.correctCount, 0);
    return total > 0 ? correct / total : 0;
  }, [sessions]);

  // [Recomendaciones IA]: derivadas de las materias con menor precisión real | [Patrón]: Heuristic-from-data
  const recommendations = useMemo(() => {
    return [...byCategory]
      .filter((c) => c.accuracy < 0.85)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 3)
      .map((c) => ({
        category: c.key,
        accuracy: c.accuracy,
        label: categoryLabel(c.key),
      }));
  }, [byCategory]);

  // [Tendencia]: últimos 20 puntos en orden cronológico | [Patrón]: Map-Transform
  const trend = useMemo(() => {
    return [...history]
      .reverse()
      .slice(-20)
      .map((h, idx) => ({
        idx: idx + 1,
        accuracy: Math.round(h.accuracy * 100),
        points: h.points,
        date: new Date(h.createdAt).toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "short",
        }),
      }));
  }, [history]);

  // [Distribución por accuracy bucket]: <40, 40-70, >70 | [Patrón]: Bucketing
  const distribution = useMemo(() => {
    const buckets = { low: 0, mid: 0, high: 0 };
    for (const h of history) {
      if (h.accuracy < 0.4) buckets.low += 1;
      else if (h.accuracy < 0.7) buckets.mid += 1;
      else buckets.high += 1;
    }
    return [
      { range: "< 40%", quizzes: buckets.low, fill: "#ef4444" },
      { range: "40 – 70%", quizzes: buckets.mid, fill: "#f59e0b" },
      { range: "≥ 70%", quizzes: buckets.high, fill: "#a855f7" },
    ];
  }, [history]);

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive"
      >
        {error}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="w-full space-y-5 py-4">
        <section className="rounded-xl border bg-card p-8 text-center space-y-3">
          <h2 className="text-xl font-bold">Aún no hay historial</h2>
          <p className="text-sm text-muted-foreground">
            Completa el primer quiz para empezar a ver el progreso.
          </p>
          <Link
            href="/quiz"
            className="btn btn-primary"
          >
            Ir a Exámenes
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 py-4">
      {/* [Stats cards]: KPIs rápidos | [Patrón]: Card Composite */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Quizzes" value={stats.totalQuizzes.toString()} />
        <StatCard label="Puntos totales" value={stats.totalPoints.toLocaleString("es-ES")} />
        <StatCard
          label="Precisión promedio"
          value={`${Math.round(stats.avgAccuracy * 100)}%`}
        />
        <StatCard
          label="Mejor precisión"
          value={`${Math.round(stats.bestAccuracy * 100)}%`}
        />
      </section>

      {/* [Gráfica tendencia accuracy]: últimos 20 quizzes | [Patrón]: Line Chart */}
      <section className="rounded-xl border bg-card p-5 space-y-3">
        <h2 className="text-lg font-bold">Tendencia de precisión</h2>
        <p className="text-xs text-muted-foreground">
          Eje X: fecha de cada examen resuelto · Eje Y: precisión (% de aciertos). Últimos {trend.length} quizzes.
        </p>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 10, right: 16, left: 8, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                label={{ value: "Fecha del examen", position: "insideBottom", offset: -12, fontSize: 11 }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                label={{ value: "Precisión (%)", angle: -90, position: "insideLeft", fontSize: 11 }}
              />
              <Tooltip
                formatter={(value) => [`${value as number}%`, "Precisión"]}
                contentStyle={{ fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey="accuracy"
                stroke="#7c3aed"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* [Distribución accuracy]: bucketing global | [Patrón]: Bar Chart */}
      <section className="rounded-xl border bg-card p-5 space-y-3">
        <h2 className="text-lg font-bold">Distribución por rango de precisión</h2>
        <p className="text-xs text-muted-foreground">
          Eje X: rango de precisión · Eje Y: cantidad de quizzes que caen en cada rango.
        </p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distribution} margin={{ top: 10, right: 16, left: 8, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="range"
                tick={{ fontSize: 12 }}
                label={{ value: "Rango de precisión", position: "insideBottom", offset: -12, fontSize: 11 }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12 }}
                label={{ value: "N.º de quizzes", angle: -90, position: "insideLeft", fontSize: 11 }}
              />
              <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v) => [`${v as number}`, "Quizzes"]} />
              <Bar dataKey="quizzes" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* [Historial reciente]: tabla simple | [Patrón]: Composite */}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-bold mb-3">Historial reciente</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3 font-semibold">Fecha</th>
                <th className="py-2 pr-3 font-semibold">Aciertos</th>
                <th className="py-2 pr-3 font-semibold">Precisión</th>
                <th className="py-2 pr-3 font-semibold">Puntos</th>
              </tr>
            </thead>
            <tbody>
              {histRows.map((h) => (
                <tr key={h.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="py-2 pr-3">
                    {new Date(h.createdAt).toLocaleDateString("es-ES", {
                      year: "numeric",
                      month: "short",
                      day: "2-digit",
                    })}
                  </td>
                  <td className="py-2 pr-3">
                    {h.correctCount} / {h.totalQuestions}
                  </td>
                  <td className="py-2 pr-3 font-semibold">
                    {Math.round(h.accuracy * 100)}%
                  </td>
                  <td className="py-2 pr-3">{h.points.toLocaleString("es-ES")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* [Paginación]: 5 registros por página; visible siempre que haya datos | [Patrón]: Pager */}
        {history.length > 0 && (
          <nav className="mt-3 flex items-center justify-center gap-1.5" aria-label="Paginación historial">
            {Array.from({ length: histTotalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setHistPage(p)}
                aria-current={p === histPage ? "page" : undefined}
                className={
                  p === histPage
                    ? "min-w-8 px-2.5 py-1 rounded-lg bg-gradient-brand text-white text-sm font-semibold"
                    : "min-w-8 px-2.5 py-1 rounded-lg border border-border bg-card text-sm hover:border-primary"
                }
              >
                {p}
              </button>
            ))}
          </nav>
        )}
      </section>

      {/* [Habilidades + Distribución por materia]: ambos paneles con precisión REAL derivada de las sesiones | [Patrón]: Real-Data Panels */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* [Habilidades cognitivas (por dificultad real)] */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-lg font-bold mb-1">Desempeño por nivel MCER</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Precisión real según el nivel de dificultad de los exámenes resueltos.
          </p>
          {byDifficulty.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aún no hay datos suficientes.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {byDifficulty.map((d) => {
                const pct = Math.round(d.accuracy * 100);
                return (
                  <div key={d.key}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <b>{DIFFICULTY_LABEL[d.key]}</b>
                      <span
                        className={
                          pct >= 85
                            ? "text-tone-brand"
                            : pct >= 60
                              ? "text-foreground"
                              : "text-tone-warning"
                        }
                      >
                        {pct}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-brand"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {d.correct}/{d.total} preguntas correctas
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* [Distribución por materia (categoría real)] */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-lg font-bold mb-1">Distribución por competencia</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Precisión global {Math.round(overallAccuracy * 100)}% · desglose por categoría.
          </p>
          {byCategory.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aún no hay datos suficientes.
            </p>
          ) : (
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
                    <b className="w-10 text-right text-sm tabular-nums">{pct}%</b>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* [Recomendaciones IA personalizadas]: derivadas de las materias con menor precisión real | [Patrón]: Data-Driven Recommendation */}
      {recommendations.length > 0 && (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-lg font-bold mb-3">Recomendaciones IA personalizadas</h2>
          <div className="flex flex-col gap-3">
            {recommendations.map((r) => (
              <div
                key={r.category}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <b className="text-sm">Refuerza {r.label}</b>
                  <p className="text-xs text-muted-foreground">
                    Precisión actual {Math.round(r.accuracy * 100)}% — practica más
                    prácticas de esta competencia para mejorar.
                  </p>
                </div>
                <Link
                  href={`/quiz?category=${r.category}`}
                  className="btn btn-outline btn-sm shrink-0"
                >
                  Ver exámenes
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// [StatCard]: componente atómico card de KPI | [Patrón]: Presentational + Atomic Design (atom)
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight">{value}</p>
    </div>
  );
}
