import type { Metadata } from "next";
import { RememberReturn } from "@/components/shared/RememberReturn"; // [2026-10-23 · 4.º pase]: el «Volver» de los formularios regresa a esta pestaña/filtros
import Link from "next/link";
import { listQuizzes } from "@/lib/quiz-api";
import type { PaginatedQuizzes } from "@/types/quiz";
import { QuizAdminTable } from "@/components/quiz/QuizAdminTable";
import { ManagementHeader } from "@/components/portal/ManagementHeader";

export const metadata: Metadata = {
  title: "Gestión",
  description: "Panel de gestión de exámenes (Docente).",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface SearchParams {
  page?: string;
  category?: string;
  difficulty?: string;
}

function buildQuery(sp: SearchParams, overrides: Record<string, string>): string {
  const merged: Record<string, string> = { ...overrides };
  for (const [k, v] of Object.entries(sp)) {
    if (v !== undefined && !(k in overrides)) merged[k] = v;
  }
  return new URLSearchParams(merged).toString();
}

export default async function TeacherQuizzesPage(props: { searchParams: Promise<SearchParams> }) {
  const sp = await props.searchParams;

  let data: PaginatedQuizzes;
  let error: string | null = null;
  try {
    // [publishedOnly=false]: panel docente debe listar borradores también para activarlos | [Patrón]: Author View
    data = await listQuizzes({
      page: sp.page ? parseInt(sp.page, 10) : 1,
      category: sp.category,
      difficulty: sp.difficulty,
      publishedOnly: false,
    });
  } catch (err) {
    error = err instanceof Error ? err.message : "Error cargando exámenes";
    data = { data: [], total: 0, page: 1, limit: 12 };
  }

  return (
    // [Semántica]: <div> (el layout del portal ya aporta el <main>)
    <div className="w-full space-y-5 py-4">
      <RememberReturn memo="exams" />
      {/* [Cabecera + pestañas de Gestión]: Exámenes · Contenido — el contenido curricular ya no es una sección aparte */}
      <ManagementHeader role="docente" active="exams" />

      <section className="space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <p className="text-sm text-muted-foreground">
            {data.total} {data.total === 1 ? "examen" : "exámenes"} en la plataforma.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/quiz/create"
              className="btn btn-primary"
            >
              + Crear examen
            </Link>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        <QuizAdminTable quizzes={data.data} />

        {data.total > data.limit && (
          <nav className="flex items-center justify-center gap-2" aria-label="Paginación">
            {Array.from({ length: Math.ceil(data.total / data.limit) }, (_, i) => i + 1).map((p) => (
              <a
                key={p}
                href={`/teacher/quizzes?${buildQuery(sp, { page: String(p) })}`}
                className={
                  p === data.page
                    ? "btn btn-primary btn-sm min-w-9"
                    : "btn btn-outline btn-sm min-w-9"
                }
              >
                {p}
              </a>
            ))}
          </nav>
        )}
      </section>
    </div>
  );
}
