import { Medal, Trophy } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis)
import { RememberReturn } from "@/components/shared/RememberReturn"; // [2026-10-23 · 4.º pase]: el «Volver» de los formularios regresa a esta pestaña/filtros
import type { Metadata } from "next";
import Link from "next/link";
import { listStudents, getLeaderboard } from "@/lib/quiz-api";
import type { StudentListItem } from "@/lib/quiz-api";
import type { LeaderboardEntry } from "@/types/quiz";
import { AnalyticsFilters } from "@/components/portal/AnalyticsFilters";
import { parsePeriod } from "@/lib/period";
// [Página Resultados y seguimiento (Docente/Admin)]: stats agregadas + tabla por estudiante con puntaje/estado/progreso reales | [Patrón]: Container/Presentational (RSC) | [Principio]: SRP | [Paradigma]: Server Component

export const metadata: Metadata = {
  title: "Resultados",
  description: "Desempeño y progreso por idioma y nivel de los estudiantes (TEACHER+).",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface SearchParams {
  search?: string;
  period?: string;
  page?: string;
  lbpage?: string;
}

// [Paginación]: 5 filas por página | [Patrón]: Page Size Constant
const PAGE_SIZE = 5;

// [initials]: 2 letras del nombre | [Patrón]: Pure Function
function initials(first: string, last: string): string {
  const a = first?.[0] ?? "";
  const b = last?.[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

interface StudentRow {
  student: StudentListItem;
  totalPoints: number | null;
  avgAccuracy: number | null;
  quizzesCompleted: number;
}

export default async function TeacherStudentsPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await props.searchParams;
  const search = sp.search?.trim().toLowerCase();
  const months = parsePeriod(sp.period);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const lbPage = Math.max(1, parseInt(sp.lbpage ?? "1", 10) || 1);

  let students: StudentListItem[] = [];
  let leaderboard: LeaderboardEntry[] = [];
  let error: string | null = null;
  try {
    // [Paralelo]: lista de alumnos + agregados de puntaje (leaderboard filtrado por periodo) | [Patrón]: Promise.all
    const [studentsRes, lb] = await Promise.all([
      listStudents({ limit: 200, search: sp.search }),
      getLeaderboard(200, { months }).then((r) => r.entries).catch(() => []),
    ]);
    students = studentsRes.data;
    leaderboard = lb;
  } catch (err) {
    error = err instanceof Error ? err.message : "Error cargando resultados";
  }

  // [Index leaderboard por userId]: merge O(1) puntaje/precisión por alumno | [Patrón]: Lookup Map
  const byUser = new Map(leaderboard.map((e) => [e.userId, e] as const));

  const rows: StudentRow[] = students
    .filter((s) =>
      search
        ? `${s.firstName} ${s.lastName} ${s.email}`.toLowerCase().includes(search)
        : true,
    )
    .map((student) => {
      const lb = byUser.get(student.id);
      return {
        student,
        totalPoints: lb ? Math.round(lb.totalPoints) : null,
        avgAccuracy: lb ? lb.avgAccuracy : null,
        quizzesCompleted: lb ? lb.quizzesCompleted : 0,
      };
    });

  // [Paginación de la tabla]: 10 filas/página; las stats siguen calculándose sobre TODO el grupo | [Patrón]: Client-side Paging
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    if (sp.search) q.set("search", sp.search);
    if (sp.period) q.set("period", sp.period);
    if (sp.lbpage) q.set("lbpage", sp.lbpage);
    q.set("page", String(p));
    return `/teacher/students?${q.toString()}`;
  };

  // [Paginación leaderboard]: 5 por página, param propio (lbpage) para no chocar con la tabla | [Patrón]: Scoped Pager
  const LB_PAGE_SIZE = 5;
  const lbTotalPages = Math.max(1, Math.ceil(leaderboard.length / LB_PAGE_SIZE));
  const lbCurrentPage = Math.min(lbPage, lbTotalPages);
  const lbRows = leaderboard.slice(
    (lbCurrentPage - 1) * LB_PAGE_SIZE,
    lbCurrentPage * LB_PAGE_SIZE,
  );
  const lbPageHref = (p: number) => {
    const q = new URLSearchParams();
    if (sp.search) q.set("search", sp.search);
    if (sp.period) q.set("period", sp.period);
    if (sp.page) q.set("page", sp.page);
    q.set("lbpage", String(p));
    return `/teacher/students?${q.toString()}`;
  };

  // [Stats agregadas]: solo sobre alumnos con actividad | [Principio]: SRP
  const withActivity = rows.filter((r) => r.avgAccuracy !== null);
  const avgScore =
    withActivity.length > 0
      ? Math.round(
          (withActivity.reduce((s, r) => s + (r.avgAccuracy ?? 0), 0) /
            withActivity.length) *
            100,
        )
      : 0;
  const bestScore =
    withActivity.length > 0
      ? Math.round(Math.max(...withActivity.map((r) => r.avgAccuracy ?? 0)) * 100)
      : 0;
  const approvalRate =
    withActivity.length > 0
      ? Math.round(
          (withActivity.filter((r) => (r.avgAccuracy ?? 0) >= 0.6).length /
            withActivity.length) *
            100,
        )
      : 0;

  // [Distribución de puntajes]: cuenta estudiantes por rango de precisión real | [Patrón]: Bucketing
  const buckets = [
    { label: "0-40", min: 0, max: 0.4, count: 0 },
    { label: "41-60", min: 0.4, max: 0.6, count: 0 },
    { label: "61-75", min: 0.6, max: 0.75, count: 0 },
    { label: "76-85", min: 0.75, max: 0.85, count: 0 },
    { label: "86-100", min: 0.85, max: 1.01, count: 0 },
  ];
  for (const r of withActivity) {
    const a = r.avgAccuracy ?? 0;
    const b = buckets.find((x) => a >= x.min && a < x.max);
    if (b) b.count += 1;
  }
  const maxBucket = Math.max(1, ...buckets.map((b) => b.count));
  const pendingCount = rows.length - withActivity.length;

  return (
    <div className="w-full space-y-5 py-4">
      <RememberReturn memo="students" />
      {/* [2026-10-23 · 4.º pase]: periodo + Filtrar DEBAJO del título (antes a su misma altura) → misma jerarquía que Recursos */}
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Resultados y seguimiento</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visualiza el desempeño y progreso de tus estudiantes por idioma y nivel.
        </p>
      </header>
      <AnalyticsFilters />

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {/* [Stats agregadas reales] */}
      <section className="grid gap-4 sm:grid-cols-4" aria-label="Resumen del grupo">
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Precisión promedio</p>
          <p className="mt-1 text-2xl font-extrabold">
            {avgScore}
            <span className="text-base text-muted-foreground">/100</span>
          </p>
        </article>
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Mejor precisión</p>
          <p className="mt-1 text-2xl font-extrabold">{bestScore}</p>
        </article>
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Con actividad</p>
          <p className="mt-1 text-2xl font-extrabold">
            {withActivity.length}
            <span className="text-base text-muted-foreground">/{rows.length}</span>
          </p>
        </article>
        <article className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Aprobación (≥60%)</p>
          <p className="mt-1 text-2xl font-extrabold">{approvalRate}%</p>
        </article>
      </section>

      {/* [Distribución de puntajes + resumen de actividad] */}
      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-lg font-bold mb-3">Distribución de puntajes</h2>
          {withActivity.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aún no hay estudiantes con actividad.
            </p>
          ) : (
            <div>
              <div className="flex items-stretch gap-2">
                {/* [Eje Y rotado]: título del eje vertical | [Patrón]: Axis Label */}
                <span
                  className="text-[11px] font-medium text-muted-foreground"
                  style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                >
                  N.º de estudiantes
                </span>
                <div className="flex-1 flex items-end gap-3 h-44">
                  {buckets.map((b) => (
                    <div key={b.label} className="flex-1 flex flex-col items-center gap-1.5">
                      <span className="text-xs font-semibold">{b.count}</span>
                      <div className="w-full flex items-end h-32">
                        <div
                          className="w-full rounded-t bg-gradient-brand"
                          style={{ height: `${Math.max(4, (b.count / maxBucket) * 100)}%` }}
                          title={`${b.count} estudiante(s) en ${b.label}%`}
                        />
                      </div>
                      <span className="text-[11px] text-muted-foreground">{b.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* [Eje X]: título centrado bajo las barras | [Patrón]: Axis Label */}
              <p className="mt-1 text-center text-[11px] font-medium text-muted-foreground">
                Rango de precisión (%)
              </p>
            </div>
          )}
        </div>
        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-lg font-bold mb-3">Resumen de actividad</h2>
          <ul className="space-y-2.5 text-sm">
            <li className="flex justify-between">
              <span className="text-muted-foreground">Total estudiantes</span>
              <b>{rows.length}</b>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">Con actividad</span>
              <b className="text-tone-brand">{withActivity.length}</b>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">Pendientes</span>
              <b className="text-tone-warning">{pendingCount}</b>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">Aprobación (≥60%)</span>
              <b>{approvalRate}%</b>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">Necesitan refuerzo (&lt;60%)</span>
              <b className="text-tone-danger">
                {withActivity.filter((r) => (r.avgAccuracy ?? 0) < 0.6).length}
              </b>
            </li>
          </ul>
        </div>
      </section>

      {/* [Leaderboard embebido]: ranking de estudiantes (info personal) — vive aquí, no en vista de alumnos | [Patrón]: Scoped Composition | [Principio]: Least Privilege */}
      <section className="rounded-xl border bg-card p-5 space-y-3" aria-label="Tabla de clasificación">
        <div>
          <h2 className="text-lg font-bold"><Trophy aria-hidden className="inline size-4 align-[-0.125em]" /> Leaderboard</h2>
          <p className="text-xs text-muted-foreground">
            Ranking de estudiantes por puntos acumulados{" "}
            {months ? `(últimos ${months} meses)` : "(histórico)"}.
          </p>
        </div>
        {leaderboard.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Sin actividad registrada en este periodo.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-3 font-semibold">#</th>
                  <th className="py-2 pr-3 font-semibold">Estudiante</th>
                  <th className="py-2 pr-3 font-semibold text-right">Puntos</th>
                  <th className="py-2 pr-3 font-semibold text-right hidden sm:table-cell">Exámenes</th>
                  <th className="py-2 pr-3 font-semibold text-right hidden sm:table-cell">Precisión</th>
                </tr>
              </thead>
              <tbody>
                {lbRows.map((e, i) => {
                  const rank = (lbCurrentPage - 1) * LB_PAGE_SIZE + i;
                  return (
                  <tr key={e.userId} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-2 pr-3 font-bold">
                      {rank <= 2 ? <Medal aria-label={`Puesto ${rank + 1}`} className="inline size-5" style={{ color: ["#f59e0b", "#94a3b8", "#b45309"][rank] }} /> : `#${rank + 1}`}
                    </td>
                    <td className="py-2 pr-3 font-medium">
                      {e.displayName || `Usuario ${e.userId.slice(0, 6)}`}
                    </td>
                    <td className="py-2 pr-3 text-right font-bold tabular-nums">
                      {Math.round(e.totalPoints).toLocaleString("es-ES")}
                    </td>
                    <td className="py-2 pr-3 text-right hidden sm:table-cell">
                      {e.quizzesCompleted}
                    </td>
                    <td className="py-2 pr-3 text-right hidden sm:table-cell tabular-nums">
                      {Math.round(e.avgAccuracy * 100)}%
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {/* [Paginación leaderboard]: 5 por página; visible siempre que haya datos | [Patrón]: Pager */}
        {leaderboard.length > 0 && (
          <nav className="flex items-center justify-center gap-1.5" aria-label="Paginación leaderboard">
            {Array.from({ length: lbTotalPages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={lbPageHref(p)}
                aria-current={p === lbCurrentPage ? "page" : undefined}
                className={
                  p === lbCurrentPage
                    ? "btn btn-primary btn-sm min-w-9"
                    : "btn btn-outline btn-sm min-w-9"
                }
              >
                {p}
              </Link>
            ))}
          </nav>
        )}
      </section>

      {/* [Tabla por estudiante] */}
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Resultados por estudiante</h2>
          <form method="get" action="/teacher/students" role="search">
            {/* [Preserva periodo al buscar]: el filtro de periodo no se pierde | [Patrón]: Hidden State */}
            {sp.period && <input type="hidden" name="period" value={sp.period} />}
            <input
              type="search"
              name="search"
              defaultValue={sp.search ?? ""}
              placeholder="Buscar estudiante…"
              aria-label="Buscar estudiante"
              className="control min-w-[220px]"
            />
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 px-3 font-semibold">Estudiante</th>
                <th className="py-2 px-3 font-semibold">Email</th>
                <th className="py-2 px-3 font-semibold text-right">Precisión</th>
                <th className="py-2 px-3 font-semibold text-right hidden sm:table-cell">Exámenes</th>
                <th className="py-2 px-3 font-semibold">Estado</th>
                <th className="py-2 px-3 font-semibold hidden md:table-cell">Progreso</th>
                <th className="py-2 px-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No hay estudiantes que coincidan.
                  </td>
                </tr>
              ) : (
                pageRows.map(({ student: s, totalPoints, avgAccuracy, quizzesCompleted }) => {
                  const pct = avgAccuracy !== null ? Math.round(avgAccuracy * 100) : 0;
                  const hasActivity = avgAccuracy !== null;
                  const status = !hasActivity
                    ? { label: "Pendiente", cls: "bg-muted text-muted-foreground" }
                    : pct >= 60
                      ? { label: "Completado", cls: "bg-tone-brand-soft text-tone-brand" }
                      : { label: "Reforzar", cls: "bg-tone-warning-soft text-tone-warning" };
                  return (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2.5">
                          <span className="grid place-items-center size-8 rounded-full bg-gradient-brand text-white text-xs font-bold">
                            {initials(s.firstName, s.lastName)}
                          </span>
                          <b>
                            {s.firstName} {s.lastName}
                          </b>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">{s.email}</td>
                      <td className="py-2 px-3 text-right font-bold tabular-nums">
                        {hasActivity ? `${pct}/100` : "—"}
                      </td>
                      <td className="py-2 px-3 text-right hidden sm:table-cell">
                        {hasActivity ? quizzesCompleted : "—"}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.cls}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="py-2 px-3 hidden md:table-cell">
                        <div className="h-2 w-28 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-brand"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <Link
                          href={`/teacher/students/${s.id}/history`}
                          className="btn btn-outline btn-sm"
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* [Paginación]: 10 estudiantes por página | [Patrón]: Pager */}
        {totalPages > 1 && (
          <nav className="flex items-center justify-center gap-1.5" aria-label="Paginación">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={pageHref(p)}
                aria-current={p === currentPage ? "page" : undefined}
                className={
                  p === currentPage
                    ? "btn btn-primary btn-sm min-w-9"
                    : "btn btn-outline btn-sm min-w-9"
                }
              >
                {p}
              </Link>
            ))}
          </nav>
        )}

        <p className="text-xs text-muted-foreground">
          La precisión y los exámenes mostrados son acumulados sobre todos los exámenes
          resueltos por cada estudiante. Usa &ldquo;Ver&rdquo; para el detalle por examen y pregunta.
        </p>
      </section>
    </div>
  );
}
