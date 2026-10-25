import { Suspense } from "react";
import { getMyHistory, getMySessionsHistory } from "@/lib/quiz-api";
import { ProgressClient } from "./ProgressClient";
import { AnalyticsFilters } from "@/components/portal/AnalyticsFilters";
import { parsePeriod, monthsToSince } from "@/lib/period";
import type { MyHistoryItem, ScoreEntry } from "@/types/quiz";
// [Página Progreso /profile]: stats + historial + tendencia | [Patrón]: Container (RSC) + Presentational (Client) | [Principio]: SRP | [Paradigma]: RSC + Server Fetch

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Progreso",
  description: "Historial de quizzes, precisión promedio y análisis de tendencias.",
};

// [Skeleton Suspense]: visible mientras llega el historial | [Patrón]: Suspense Boundary
function ProgressSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 rounded bg-muted animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-muted animate-pulse" />
    </div>
  );
}

async function ProgressData({ months }: { months?: number }) {
  // [Server fetch]: corre en el server, manda cookies httpOnly al backend | [Principio]: SSOT
  let history: ScoreEntry[] = [];
  let sessions: MyHistoryItem[] = [];
  let error: string | null = null;
  try {
    // [Paralelo]: historial propio (filtrado por periodo en backend) + sesiones. El leaderboard se excluye: info de otros estudiantes, exclusiva del docente | [Patrón]: Promise.all | [Principio]: Least Privilege
    const [h, ss] = await Promise.all([
      getMyHistory(50, months),
      getMySessionsHistory(50).catch(() => []),
    ]);
    history = h;
    // [Filtro de periodo en cliente]: las sesiones traen startedAt; recortamos a la ventana | [Patrón]: Time Window
    const since = monthsToSince(months);
    sessions = since
      ? ss.filter((s) => new Date(s.startedAt) >= since)
      : ss;
  } catch (err) {
    error = err instanceof Error ? err.message : "No se pudo cargar el historial";
  }

  return (
    <ProgressClient
      history={history}
      sessions={sessions}
      error={error}
    />
  );
}

export default async function ProfilePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  const months = parsePeriod(sp.period);
  return (
    <div className="w-full space-y-5 py-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Progreso</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Historial de quizzes, precisión promedio y temas a reforzar.
          </p>
        </div>
        <AnalyticsFilters />
      </header>
      <Suspense fallback={<ProgressSkeleton />}>
        <ProgressData months={months} />
      </Suspense>
    </div>
  );
}
