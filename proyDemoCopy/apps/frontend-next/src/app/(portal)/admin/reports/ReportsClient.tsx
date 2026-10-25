"use client";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LeaderboardEntry, QuizListItem } from "@/types/quiz";
import { labelCategory, labelDifficulty } from "@/lib/constants";
// [ReportsClient]: 4 secciones de reporte basadas en datos reales | [Patron]: Presentational | [Principio]: SRP

export interface ReportsClientProps {
  userStats: { total: number; byRole: Record<string, number> };
  leaderboard: LeaderboardEntry[];
  quizzes: QuizListItem[];
}

const ROLE_LABEL: Record<string, string> = {
  USER: "Estudiantes",
  TEACHER: "Docentes",
  ADMIN: "Administradores",
};

const ROLE_COLORS: Record<string, string> = {
  USER: "#6366f1",
  TEACHER: "#06b6d4",
  ADMIN: "#f59e0b",
};

export function ReportsClient({ userStats, leaderboard, quizzes }: ReportsClientProps) {
  // [Distribución usuarios por rol]: input para PieChart | [Patrón]: Map-Transform
  const rolePie = useMemo(
    () =>
      Object.entries(userStats.byRole).map(([role, count]) => ({
        name: ROLE_LABEL[role] ?? role,
        value: count,
        color: ROLE_COLORS[role] ?? "#94a3b8",
      })),
    [userStats],
  );

  // [Quizzes por categoría]: bar chart | [Patrón]: Bucketing
  const quizzesByCategory = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (const q of quizzes) {
      const key = labelCategory(q.category);
      buckets[key] = (buckets[key] ?? 0) + 1;
    }
    return Object.entries(buckets)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }, [quizzes]);

  // [Quizzes por dificultad]: bar chart secundario
  const quizzesByDifficulty = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (const q of quizzes) {
      const key = labelDifficulty(q.difficulty);
      buckets[key] = (buckets[key] ?? 0) + 1;
    }
    return Object.entries(buckets).map(([difficulty, count]) => ({ difficulty, count }));
  }, [quizzes]);

  // [Stats agregadas leaderboard]: promedios reales | [Patrón]: Aggregate
  const leaderboardStats = useMemo(() => {
    if (leaderboard.length === 0) {
      return { totalPoints: 0, avgAccuracy: 0, totalQuizzesPlayed: 0 };
    }
    const totalPoints = leaderboard.reduce((s, e) => s + e.totalPoints, 0);
    const avgAccuracy = leaderboard.reduce((s, e) => s + e.avgAccuracy, 0) / leaderboard.length;
    const totalQuizzesPlayed = leaderboard.reduce((s, e) => s + e.quizzesCompleted, 0);
    return { totalPoints, avgAccuracy, totalQuizzesPlayed };
  }, [leaderboard]);

  return (
    <div className="space-y-6">
      {/* [Stats globales]: 4 KPIs | [Patrón]: Composite */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total usuarios" value={userStats.total.toString()} />
        <StatCard label="Total quizzes" value={quizzes.length.toString()} />
        <StatCard
          label="Quizzes jugados"
          value={leaderboardStats.totalQuizzesPlayed.toLocaleString("es-ES")}
        />
        <StatCard
          label="Precisión promedio"
          value={`${Math.round(leaderboardStats.avgAccuracy * 100)}%`}
        />
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {/* [Pie chart usuarios por rol] */}
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-lg font-bold mb-3">Distribución de usuarios</h2>
          {rolePie.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={rolePie} dataKey="value" nameKey="name" innerRadius={45} outerRadius={85}>
                    {rolePie.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <ul className="mt-3 space-y-1 text-sm">
            {rolePie.map((r) => (
              <li key={r.name} className="flex items-center gap-2">
                <span className="size-3 rounded-full" style={{ backgroundColor: r.color }} aria-hidden />
                <span className="flex-1">{r.name}</span>
                <b>{r.value}</b>
              </li>
            ))}
          </ul>
        </section>

        {/* [Bar chart quizzes por categoría] */}
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-lg font-bold mb-3">Quizzes por categoría</h2>
          {quizzesByCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin quizzes registrados.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={quizzesByCategory} margin={{ top: 10, right: 16, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="category"
                    tick={{ fontSize: 11 }}
                    angle={-25}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="count" fill="#7c3aed" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      {/* [Bar chart por dificultad] */}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-bold mb-3">Quizzes por dificultad</h2>
        {quizzesByDifficulty.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos.</p>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={quizzesByDifficulty} margin={{ top: 10, right: 16, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="difficulty" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" fill="#06b6d4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* [Top 10 leaderboard real] */}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-bold mb-3">Top 10 estudiantes</h2>
        {leaderboard.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin actividad aún.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 px-3 font-semibold">#</th>
                  <th className="py-2 px-3 font-semibold">Usuario</th>
                  <th className="py-2 px-3 font-semibold">Quizzes</th>
                  <th className="py-2 px-3 font-semibold">Precisión</th>
                  <th className="py-2 px-3 font-semibold">Puntos</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.slice(0, 10).map((e) => (
                  <tr key={e.userId} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-2 px-3 font-semibold">{e.rank}</td>
                    <td className="py-2 px-3 text-xs font-medium">{e.displayName || `Usuario ${e.userId.slice(0, 6)}`}</td>
                    <td className="py-2 px-3">{e.quizzesCompleted}</td>
                    <td className="py-2 px-3 font-semibold">{Math.round(e.avgAccuracy * 100)}%</td>
                    <td className="py-2 px-3">{e.totalPoints.toLocaleString("es-ES")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight">{value}</p>
    </div>
  );
}
