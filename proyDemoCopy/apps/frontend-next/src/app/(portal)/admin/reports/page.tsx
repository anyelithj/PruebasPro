import type { Metadata } from "next";
import { getLeaderboard, getUserStats, listQuizzes } from "@/lib/quiz-api";
import { ReportsClient } from "./ReportsClient";
import { AnalyticsFilters } from "@/components/portal/AnalyticsFilters";
import { parsePeriod } from "@/lib/period";
import { AngularElements } from "@/components/shared/AngularElements"; // [Sprint 6.4]: <aula-exportar> del remoto Angular
// [Página Admin Reportes]: agregados sistema | [Patrón]: Container (RSC) + Presentational (Client) | [Principio]: SRP

export const metadata: Metadata = {
  title: "Reportes",
  description: "Reportes agregados del sistema (ADMIN).",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminReportsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  const months = parsePeriod(sp.period);

  // [Server-side fetch paralelo]: 3 fuentes de datos agregadas; leaderboard filtrado por periodo | [Patrón]: Aggregator
  const [usersStats, leaderboardRes, quizzesRes] = await Promise.allSettled([
    getUserStats(),
    getLeaderboard(20, { months }),
    listQuizzes({ limit: 100 }),
  ]);

  const userStats =
    usersStats.status === "fulfilled" ? usersStats.value : { total: 0, byRole: {} };
  const leaderboard =
    leaderboardRes.status === "fulfilled" ? leaderboardRes.value.entries : [];
  const quizzes =
    quizzesRes.status === "fulfilled" ? quizzesRes.value.data : [];

  const errors: string[] = [];
  if (usersStats.status === "rejected")
    errors.push(`Usuarios: ${usersStats.reason instanceof Error ? usersStats.reason.message : "error"}`);
  if (leaderboardRes.status === "rejected")
    errors.push(`Leaderboard: ${leaderboardRes.reason instanceof Error ? leaderboardRes.reason.message : "error"}`);
  if (quizzesRes.status === "rejected")
    errors.push(`Quizzes: ${quizzesRes.reason instanceof Error ? quizzesRes.reason.message : "error"}`);

  return (
    <div className="w-full space-y-5 py-4">
      {/* [2026-10-23 · 4.º pase]: la barra de filtros va DEBAJO del título (antes a su altura, a la derecha) → misma jerarquía que Recursos | [Semántica]: <header> = título + subtítulo; la barra es un <div> de herramientas */}
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Reportes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Métricas agregadas del sistema: usuarios, quizzes y desempeño.
        </p>
      </header>
      <div className="flex flex-wrap items-center gap-3">
        {/* [2026-10-19]: periodo + Filtrar y formato + Exportar en UNA barra alineada al centro (todos los controles miden 40 px) */}
        <div className="flex flex-wrap items-center gap-3">
          <AnalyticsFilters />
          {/* [Angular Element]: exporta a PDF, Excel o Word el mismo periodo filtrado; el aviso «listo» llega a la campana por SSE */}
          <aula-exportar period-months={months ?? 0} />
        </div>
        <AngularElements />
      </div>

      {errors.length > 0 && (
        <div role="alert" className="rounded-lg border border-tone-warning-line bg-tone-warning-soft px-4 py-3 text-sm">
          <p className="font-semibold mb-1">Algunos reportes no se cargaron:</p>
          <ul className="list-disc list-inside">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <ReportsClient
        userStats={userStats}
        leaderboard={leaderboard}
        quizzes={quizzes}
      />
    </div>
  );
}
