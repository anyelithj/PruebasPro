import Link from "next/link";
import type { Metadata } from "next";
import { Users, GraduationCap, FileText, TrendingUp } from "lucide-react";
import { Topbar } from "@/components/portal/Topbar";
import { StatCard } from "@/components/portal/StatCard";
import { Panel, PanelHead } from "@/components/portal/Panel";
import { Tag } from "@/components/portal/Tag";
import { getLeaderboard, getUserStats, listQuizzes, listUsers, type AdminUser } from "@/lib/quiz-api";
import { AnalyticsFilters } from "@/components/portal/AnalyticsFilters";
import { parsePeriod } from "@/lib/period";
import { BRAND } from "@/config/brand";
// [Dashboard Admin]: KPIs reales + tabla usuarios recientes | [Patrón]: Container (RSC) | [Principio]: SRP | [Paradigma]: RSC

export const metadata: Metadata = {
  title: "Dashboard Administrador",
  description: `Supervisión general de la plataforma ${BRAND.name}.`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  USER: "Estudiante",
  TEACHER: "Docente",
  ADMIN: "Administrador",
};

const ROLE_TONE: Record<string, "default" | "amber" | "success"> = {
  USER: "default",
  TEACHER: "amber",
  ADMIN: "success",
};

export default async function AdminDashboardPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  const months = parsePeriod(sp.period);

  // [Server-fetch paralelo]: usuarios, quizzes, leaderboard (filtrado por periodo), top usuarios recientes | [Patrón]: Aggregator
  const [statsRes, quizzesRes, leaderboardRes, usersRes] = await Promise.allSettled([
    getUserStats(),
    listQuizzes({ limit: 100 }),
    getLeaderboard(20, { months }),
    listUsers({ page: 1, limit: 5 }),
  ]);

  const stats =
    statsRes.status === "fulfilled" ? statsRes.value : { total: 0, byRole: {} };
  const quizzes = quizzesRes.status === "fulfilled" ? quizzesRes.value.data : [];
  const leaderboard =
    leaderboardRes.status === "fulfilled" ? leaderboardRes.value.entries : [];
  const recentUsers: AdminUser[] =
    usersRes.status === "fulfilled" ? usersRes.value.data : [];

  const totalSessions = leaderboard.reduce((s, e) => s + e.quizzesCompleted, 0);

  return (
    <>
      <Topbar
        title="Panel administrador"
        subtitle={`Supervisión general de la plataforma ${BRAND.name}.`}
      />

      {/* [Filtro de periodo]: afecta leaderboard y sesiones jugadas | [Patrón]: Controlled URL State */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground">Periodo:</span>
        <AnalyticsFilters />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <StatCard
          label="Estudiantes"
          value={(stats.byRole["USER"] ?? 0).toLocaleString("es-ES")}
          icon={Users}
        />
        <StatCard
          label="Docentes"
          value={(stats.byRole["TEACHER"] ?? 0).toLocaleString("es-ES")}
          icon={GraduationCap}
        />
        <StatCard
          label="Exámenes publicados"
          value={quizzes.length.toLocaleString("es-ES")}
          icon={FileText}
        />
        <StatCard
          label="Sesiones jugadas"
          value={totalSessions.toLocaleString("es-ES")}
          icon={TrendingUp}
        />
      </div>

      <Panel>
        <PanelHead
          title="Usuarios recientes"
          actions={
            <Link
              href="/admin/users"
              className="btn btn-outline btn-sm"
            >
              Ver todos
            </Link>
          }
        />
        <div className="overflow-x-auto -mx-2">
          <table className="w-full min-w-[600px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                {["Usuario", "Rol", "Registro", "Estado", "Acciones"].map((h) => (
                  <th
                    key={h}
                    className="text-left text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-2.5 py-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    No hay usuarios registrados todavía.
                  </td>
                </tr>
              ) : (
                recentUsers.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/60">
                    <td className="px-2.5 py-3 text-sm">
                      <b>
                        {u.firstName} {u.lastName}
                      </b>
                      <br />
                      <small className="text-muted-foreground">{u.email}</small>
                    </td>
                    <td className="px-2.5 py-3 text-sm">
                      <Tag tone={ROLE_TONE[u.role] ?? "default"}>
                        {ROLE_LABEL[u.role] ?? u.role}
                      </Tag>
                    </td>
                    <td className="px-2.5 py-3 text-sm">
                      {new Date(u.createdAt).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </td>
                    <td className="px-2.5 py-3 text-sm">
                      <Tag tone={u.isActive ? "success" : "default"}>
                        {u.isActive ? "Activo" : "Inactivo"}
                      </Tag>
                    </td>
                    <td className="px-2.5 py-3 text-sm">
                      <Link
                        href="/admin/users"
                        className="btn btn-outline btn-sm"
                      >
                        Gestionar
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
