"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
// [WeaknessChart]: barras de accuracy por tema con corte threshold | [Patron]: Presentational | [Principio]: SRP | [Paradigma]: Funcional + Declarativo

export interface WeakTopicDatum {
  topic: string;
  accuracy: number;
  recommendation?: string;
}

export interface WeaknessChartProps {
  weakTopics: WeakTopicDatum[];
  strongTopics?: string[];
  threshold?: number;
}

// [Paleta semáforo]: rojo < 30%, ámbar < 60%, verde >= 60% | [Patrón]: Lookup
function colorFor(accuracy: number, threshold: number): string {
  if (accuracy < threshold * 0.5) return "#ef4444";
  if (accuracy < threshold) return "#f59e0b";
  return "#a855f7";
}

export function WeaknessChart({ weakTopics, strongTopics = [], threshold = 0.6 }: WeaknessChartProps) {
  const data = weakTopics.map((w) => ({
    topic: w.topic,
    accuracy: Math.round(w.accuracy * 100),
    recommendation: w.recommendation,
  }));

  if (weakTopics.length === 0 && strongTopics.length === 0) {
    return (
      <section
        aria-label="Análisis de debilidades"
        className="rounded-xl border bg-card p-5 text-sm text-muted-foreground"
      >
        Aún no hay datos suficientes para generar el análisis. Completa más quizzes.
      </section>
    );
  }

  return (
    <section aria-label="Análisis de debilidades" className="space-y-3">
      <h2 className="text-xl font-bold tracking-tight">Análisis de debilidades</h2>
      <p className="text-sm text-muted-foreground">
        Temas con menos de {Math.round(threshold * 100)}% de aciertos identificados por el motor IA.
      </p>

      {data.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="topic"
                  tick={{ fontSize: 12 }}
                  angle={-20}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 12 }}
                  label={{ value: "% Acierto", angle: -90, position: "insideLeft", fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value) => [`${value as number}%`, "Aciertos"]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="accuracy" radius={[6, 6, 0, 0]}>
                  {data.map((entry, idx) => (
                    <Cell key={idx} fill={colorFor(entry.accuracy / 100, threshold)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <ul className="mt-4 space-y-2 text-sm">
            {data.map((d) => (
              <li key={d.topic} className="flex items-start gap-2">
                <span
                  className="mt-1 inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: colorFor(d.accuracy / 100, threshold) }}
                  aria-hidden
                />
                <div className="flex-1">
                  <p className="font-semibold capitalize">
                    {d.topic} <span className="text-muted-foreground">— {d.accuracy}%</span>
                  </p>
                  {d.recommendation && (
                    <p className="text-xs text-muted-foreground">{d.recommendation}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {strongTopics.length > 0 && (
        <div className="rounded-xl border border-tone-brand-line bg-tone-brand-soft p-4 text-sm">
          <p className="font-semibold text-tone-brand mb-1">Temas dominados</p>
          <ul className="flex flex-wrap gap-2">
            {strongTopics.map((t) => (
              <li
                key={t}
                className="rounded-full bg-tone-brand-soft text-tone-brand px-2.5 py-0.5 text-xs font-semibold capitalize"
              >
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
