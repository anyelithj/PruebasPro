import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, Circle, FileText, Medal, Users } from "lucide-react";
import { Topbar } from "@/components/portal/Topbar";
import { StatCard } from "@/components/portal/StatCard";
import { Panel, PanelHead } from "@/components/portal/Panel";
import { Tag } from "@/components/portal/Tag";
import { ChartBars } from "@/components/portal/ChartBars";
import { Donut } from "@/components/portal/Donut";
import { RecItem } from "@/components/portal/RecItem";
import { listQuizzes, getLeaderboard } from "@/lib/quiz-api";
import { categoryLabel, difficultyLabel } from "@/components/portal/quiz-format";
import { displayNameFromEmail, getCurrentUserPayload } from "@/lib/auth";
import { AnalyticsFilters } from "@/components/portal/AnalyticsFilters";
import { parsePeriod } from "@/lib/period";
import type { QuizListItem, LeaderboardEntry, Difficulty } from "@/types/quiz";
import { BRAND } from "@/config/brand";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard Docente",
  description: `Resumen de clases y exámenes activos en ${BRAND.name}.`,
  robots: { index: false, follow: false },
};

// [computeProgressBars]: tendencia accuracy del top leaderboard | [Patrón]: Map | [Principio]: SRP
function computeProgressBars(leaderboard: LeaderboardEntry[]): Array<{ label: string; height: number; value?: number }> {
  if (leaderboard.length === 0) return [];
  return leaderboard.slice(0, 8).map((e, i) => {
    const v = Math.round(e.avgAccuracy * 100);
    return { label: `#${i + 1}`, height: v, value: v };
  });
}

const MEDAL_BG = ["#fbbf24", "#94a3b8", "#cd7f32"];
// [2026-10-23]: icono <Medal> teñido con el color del puesto (antes 🥇🥈🥉)

const DIFFICULTY_TONE: Record<Difficulty, "success" | "amber" | "red"> = {
  easy: "success",
  medium: "amber",
  hard: "red",
};

async function loadData(months?: number) {
  const [quizzesRes, lbRes] = await Promise.allSettled([
    listQuizzes({ limit: 100 }),
    getLeaderboard(8, { months }),
  ]);
  const quizzes: QuizListItem[] = quizzesRes.status === "fulfilled" ? quizzesRes.value.data : [];
  const total = quizzesRes.status === "fulfilled" ? quizzesRes.value.total : 0;
  const leaderboard: LeaderboardEntry[] =
    lbRes.status === "fulfilled" ? lbRes.value.entries : [];
  return { quizzes, total, leaderboard, apiOk: quizzesRes.status === "fulfilled" };
}

export default async function DocenteDashboardPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  const months = parsePeriod(sp.period);
  const pageRaw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = Math.max(1, parseInt(pageRaw ?? "1", 10) || 1);
  const { quizzes, total, leaderboard, apiOk } = await loadData(months);

  // [Paginación "Mis exámenes activos"]: 5 por página | [Patrón]: Client Paging
  const QUIZ_PAGE_SIZE = 5;
  const quizTotalPages = Math.max(1, Math.ceil(quizzes.length / QUIZ_PAGE_SIZE));
  const quizPage = Math.min(page, quizTotalPages);
  const pageQuizzes = quizzes.slice((quizPage - 1) * QUIZ_PAGE_SIZE, quizPage * QUIZ_PAGE_SIZE);
  const quizPageHref = (p: number) => {
    const q = new URLSearchParams();
    if (sp.period && !Array.isArray(sp.period)) q.set("period", sp.period);
    q.set("page", String(p));
    return `/dashboard/docente?${q.toString()}`;
  };
  const userPayload = await getCurrentUserPayload();
  const displayName = userPayload ? displayNameFromEmail(userPayload.email) : "docente";
  const progressBars = computeProgressBars(leaderboard);

  const totalQuestions = quizzes.reduce((s, q) => s + q.questionsCount, 0);
  const avgAccuracy =
    leaderboard.length > 0
      ? Math.round(
          (leaderboard.reduce((s, e) => s + e.avgAccuracy, 0) / leaderboard.length) * 100,
        )
      : 0;
  const totalStudents = leaderboard.length;

  return (
    <>
      <Topbar
        title={`Bienvenido/a, ${displayName}`}
        subtitle={
          apiOk
            ? `${total} ${total === 1 ? "examen publicado" : "exámenes publicados"}.`
            : "API offline — mostrando datos limitados."
        }
        searchPlaceholder="Buscar estudiante…"
        actions={
          <Link
            href="/quiz/create"
            className="btn btn-primary"
          >
            + Crear examen
          </Link>
        }
      />

      {/* [Filtro de periodo]: afecta leaderboard y KPIs derivados | [Patrón]: Controlled URL State */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground">Periodo:</span>
        <AnalyticsFilters />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <StatCard label="Estudiantes activos" value={String(totalStudents)} icon={Users} />
        <StatCard label="Exámenes publicados" value={String(total)} icon={FileText} />
        <StatCard
          label="Precisión promedio"
          value={`${avgAccuracy}`}
          valueSuffix="%"
          icon={CheckCircle2}
        />
        <StatCard label="Preguntas en banco" value={String(totalQuestions)} icon={Circle} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-6">
        <Panel>
          <PanelHead
            title="Mis exámenes activos"
            actions={
              <Link
                href="/quiz"
                className="btn btn-outline btn-sm"
              >
                Gestionar
              </Link>
            }
          />
          {quizzes.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
              {apiOk
                ? "Aún no has publicado prácticas. Crea una nueva."
                : "API no disponible."}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full min-w-[600px] border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    {["Examen", "Competencia", "Preguntas", "Tiempo/preg.", "Nivel MCER"].map((h) => (
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
                  {pageQuizzes.map((q) => (
                    <tr key={q.id} className="border-b border-border last:border-0 hover:bg-muted/60">
                      <td className="px-2.5 py-3 text-sm">
                        <b>{q.title}</b>
                      </td>
                      <td className="px-2.5 py-3 text-sm">{categoryLabel(q.category)}</td>
                      <td className="px-2.5 py-3 text-sm">{q.questionsCount}</td>
                      <td className="px-2.5 py-3 text-sm">{q.timePerQuestionSeconds}s</td>
                      <td className="px-2.5 py-3 text-sm">
                        <Tag tone={DIFFICULTY_TONE[q.difficulty]}>
                          {difficultyLabel(q.difficulty)}
                        </Tag>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* [Paginación]: 5 exámenes por página | [Patrón]: Pager */}
          {quizTotalPages > 1 && (
            <nav className="mt-4 flex items-center justify-center gap-1.5" aria-label="Paginación exámenes">
              {Array.from({ length: quizTotalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={quizPageHref(p)}
                  aria-current={p === quizPage ? "page" : undefined}
                  className={
                    p === quizPage
                      ? "btn btn-primary btn-sm min-w-9"
                      : "btn btn-outline btn-sm min-w-9"
                  }
                >
                  {p}
                </Link>
              ))}
            </nav>
          )}
        </Panel>

        <Panel>
          <PanelHead title="Top estudiantes" />
          {leaderboard.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Sin actividad reciente.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {leaderboard.map((e, i) => (
                <RecItem
                  key={e.userId}
                  iconNode={i < 3 ? <Medal aria-label={`Puesto ${i + 1}`} className="size-4" style={{ color: MEDAL_BG[i] }} /> : String(e.rank)}
                  iconClassName={i < 3 ? "" : "bg-muted text-foreground"}
                  title={e.displayName || `Usuario ${e.userId.slice(0, 6)}`}
                  subtitle={`${Math.round(e.totalPoints)} pts · ${Math.round(e.avgAccuracy * 100)}% precisión · ${e.quizzesCompleted} ${e.quizzesCompleted === 1 ? "examen" : "exámenes"}`}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <Panel>
          <PanelHead title="Rendimiento top estudiantes" actions={<Tag>% precisión</Tag>} />
          <ChartBars
            bars={progressBars}
            yLabel="Precisión promedio (%)"
            xLabel="Estudiantes ordenados de mayor a menor puntaje"
          />
        </Panel>
        <Panel>
          <PanelHead title="Distribución por dificultad" />
          <Donut
            label={String(total)}
            gradient="conic-gradient(#a855f7 0 45%, #f59e0b 45% 75%, #ef4444 75% 100%)"
          />
          <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="inline-block size-2.5 rounded-sm bg-purple-500 mr-1.5" />
              {difficultyLabel("easy")}
            </div>
            <div>
              <span className="inline-block size-2.5 rounded-sm bg-amber-500 mr-1.5" />
              {difficultyLabel("medium")}
            </div>
            <div>
              <span className="inline-block size-2.5 rounded-sm bg-red-500 mr-1.5" />
              {difficultyLabel("hard")}
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
