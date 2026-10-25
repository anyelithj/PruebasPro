import { Library } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis)
import { RememberReturn } from "@/components/shared/RememberReturn"; // [2026-10-23 · 4.º pase]: el «Volver» de los formularios regresa a esta pestaña/filtros
import type { Metadata } from "next";
import Link from "next/link";
import { listQuizzes, getMySessionsHistory } from "@/lib/quiz-api";
import { QuizGrid } from "@/components/quiz/QuizGrid";

export const metadata: Metadata = {
  title: "Quizzes",
  description: "Explora todos los quizzes publicados.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface SearchParams {
  page?: string;
  category?: string;
  difficulty?: string;
}

export default async function QuizListPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await props.searchParams;

  let data;
  // [completedMap]: precisión por quiz ya resuelto por el estudiante → tarjeta marca "Completado" | [Patrón]: Lookup Map
  const completedMap: Record<string, number> = {}; // `const`: la referencia no cambia; solo se agregan claves
  try {
    const [quizzes, sessions] = await Promise.all([
      listQuizzes({
        page: sp.page ? parseInt(sp.page, 10) : 1,
        category: sp.category,
        difficulty: sp.difficulty,
      }),
      getMySessionsHistory(100).catch(() => []),
    ]);
    data = quizzes;
    // [Mejor intento por quiz]: conserva la mayor precisión entre sesiones completadas | [Patrón]: Reduce-Max
    for (const s of sessions) {
      if (s.status !== "completed") continue;
      const pct = Math.round(s.accuracy * 100);
      completedMap[s.quizId] = Math.max(completedMap[s.quizId] ?? 0, pct);
    }
  } catch (err) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6">
        <p className="text-destructive">
          No se pudo cargar la lista de quizzes — {err instanceof Error ? err.message : "error"}.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Verifica que el backend esté disponible en /api/v1/quiz.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 py-4">
      <RememberReturn memo="exams" />
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Exámenes</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          {data.total} {data.total === 1 ? "examen disponible" : "exámenes disponibles"}
        </p>
      </header>

      {data.data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center space-y-5">
          <div className="grid place-items-center size-16 rounded-2xl bg-gradient-soft mx-auto text-3xl">
            <Library aria-hidden className="mx-auto size-10 text-tone-brand" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Aún no hay exámenes publicados</h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Pídele al docente que publique exámenes.
            </p>
          </div>
        </div>
      ) : (
        <QuizGrid quizzes={data.data} completedMap={completedMap} />
      )}

      {data.total > data.limit && (
        <nav className="flex items-center justify-center gap-2 mt-8" aria-label="Paginación">
          {Array.from({ length: Math.ceil(data.total / data.limit) }, (_, i) => i + 1).map(
            (p) => (
              <Link
                key={p}
                href={{ pathname: "/quiz", query: { ...sp, page: String(p) } }}
                className={
                  p === data.page
                    ? "btn btn-primary btn-sm min-w-9"
                    : "btn btn-outline btn-sm min-w-9"
                }
              >
                {p}
              </Link>
            ),
          )}
        </nav>
      )}
    </div>
  );
}
