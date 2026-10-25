import { Medal, Trophy } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis)
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLeaderboard } from "@/lib/quiz-api";
import { getCurrentUserRole } from "@/lib/auth";
import { Role } from "@/lib/constants";
import { BRAND } from "@/config/brand";
// [LeaderboardPage]: ranking — exclusivo docente/admin (datos personales de estudiantes) | [Patron]: Container | [Principio]: SRP + Least Privilege | [Paradigma]: RSC

export const metadata: Metadata = {
  title: "Leaderboard",
  description: `Ranking global de ${BRAND.name}.`,
  robots: { index: false, follow: false },
};

// [Dynamic]: depende del rol del usuario; no se puede cachear con ISR | [Patrón]: Per-request Auth
export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  // [Guard de rol]: el ranking expone nombres/puntajes de estudiantes; solo docente/admin | [Principio]: Least Privilege
  const role = await getCurrentUserRole();
  if (role !== Role.TEACHER && role !== Role.ADMIN) {
    notFound();
  }

  let entries;
  try {
    const data = await getLeaderboard(15); // [2026-10-23 · 4.º pase]: las tablas no listan más de 15 filas
    entries = data.entries;
  } catch {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-destructive">
        No se pudo cargar el leaderboard. Verifica el backend.
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 py-4">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl"><Trophy aria-hidden className="inline size-4 align-[-0.125em]" /> Leaderboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Top {entries.length} de la comunidad. Actualiza cada 60s.
        </p>
      </header>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          Aun no hay scores registrados.
        </div>
      ) : (
        <table className="w-full rounded-2xl border border-border bg-card overflow-hidden">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Usuario</th>
              <th className="px-4 py-3 text-right">Puntos</th>
              <th className="px-4 py-3 text-right hidden sm:table-cell">Quizzes</th>
              <th className="px-4 py-3 text-right hidden sm:table-cell">Precision</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((e) => (
              <tr key={e.userId} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-bold">
                  {e.rank <= 3 ? <Medal aria-label={`Puesto ${e.rank}`} className="inline size-5" style={{ color: ["#f59e0b", "#94a3b8", "#b45309"][e.rank - 1] }} /> : `#${e.rank}`}
                </td>
                <td className="px-4 py-3 text-sm font-medium">
                  {e.displayName || `Usuario ${e.userId.slice(0, 6)}`}
                </td>
                <td className="px-4 py-3 text-right font-bold tabular-nums">
                  {Math.round(e.totalPoints)}
                </td>
                <td className="px-4 py-3 text-right hidden sm:table-cell">
                  {e.quizzesCompleted}
                </td>
                <td className="px-4 py-3 text-right hidden sm:table-cell tabular-nums">
                  {Math.round(e.avgAccuracy * 100)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
