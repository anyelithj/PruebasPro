import { PartyPopper } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis)
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { CourseOutline, OutlineNode } from "@/types/curriculum";
// [CourseTimeline]: ruta del curso como línea de tiempo Nivel → Módulo → Unidad → Lección, con la SIGUIENTE lección destacada | [Patrón]: Composite (render recursivo del árbol) + Presentational | [Principio]: SRP | [Tecnología]: React Server Component + Tailwind CSS (cero JS en el cliente)
// [Accesibilidad]: <ol> anidadas (el lector anuncia «lista, 5 elementos») · aria-current="step" en la siguiente lección · el estado va en TEXTO, no solo en el color (WCAG 1.4.1)

// [Estado de una lección]: completada · siguiente · pendiente · próximamente (sin recursos publicados) | `type` unión (TS)
type LessonState = "done" | "next" | "todo" | "soon";
const stateOf = (l: OutlineNode, nextId: string | null): LessonState =>
  l.completed ? "done" : l.id === nextId ? "next" : (l.items?.length ?? 0) === 0 ? "soon" : "todo";

// [Estilos por estado]: Lookup Table | [Principio]: OCP (nuevo estado = nueva entrada)
const DOT: Readonly<Record<LessonState, string>> = {
  done: "bg-primary text-white border-primary",
  next: "bg-card text-primary border-primary ring-4 ring-tone-brand-soft",
  todo: "bg-card text-muted-foreground border-border",
  soon: "bg-muted text-muted-foreground border-dashed border-border",
};
const LABEL: Readonly<Record<LessonState, string>> = { done: "Completada", next: "Siguiente", todo: "Pendiente", soon: "Próximamente" };
const ICON: Readonly<Record<LessonState, string>> = { done: "✓", next: "▶", todo: "", soon: "…" };

export function CourseTimeline({ courseId, outline, canEdit }: { courseId: string; outline: CourseOutline; canEdit: boolean }) {
  const { lessons, completed, nextLessonId } = outline.summary;
  const pct = lessons ? Math.round((completed / lessons) * 100) : 0; // `Math.round`: porcentaje entero
  const lessonHref = (id: string) => `/courses/${courseId}/path/${id}`;

  // [renderNode]: recursivo → cada nivel del árbol con su propio encabezado; las lecciones son los puntos de la línea
  const renderNode = (n: OutlineNode, depth: number) => {
    if (n.type === "lesson") {
      const state = stateOf(n, nextLessonId);
      const body = (
        <>
          <span className="block text-sm font-semibold">{n.title}</span>
          <span className="text-xs text-muted-foreground">
            {LABEL[state]}
            {n.topic ? ` · ${n.topic}` : ""}
          </span>
        </>
      );
      return (
        <li key={n.id} className="relative pl-9" aria-current={state === "next" ? "step" : undefined}>
          {/* Punto de la línea de tiempo: el icono es decorativo; el estado se lee en el texto */}
          <span aria-hidden className={cn("absolute left-0 top-1 grid size-6 place-items-center rounded-full border-2 text-[11px] font-bold", DOT[state])}>
            {ICON[state]}
          </span>
          {state === "soon" ? (
            <div className="rounded-lg px-2 py-1 opacity-70">{body}</div>
          ) : (
            <Link href={lessonHref(n.id)} className={cn("block rounded-lg px-2 py-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", state === "next" && "bg-tone-brand-soft")}>
              {body}
            </Link>
          )}
        </li>
      );
    }
    // Niveles, módulos y unidades: título + hijos | `depth` decide el tamaño del encabezado
    return (
      <li key={n.id} className={depth === 0 ? "space-y-3" : "space-y-2"}>
        <p className={cn("font-bold", depth === 0 ? "text-base" : depth === 1 ? "text-sm text-tone-brand" : "text-xs uppercase tracking-wide text-muted-foreground")}>
          {n.title}
        </p>
        {/* La línea vertical une las lecciones de la unidad (border-l sobre la columna de los puntos) */}
        <ol className={cn("space-y-2", n.type === "unit" && "relative ml-3 border-l-2 border-border pl-0 [&>li]:-ml-3")}>{n.children.map((c) => renderNode(c, depth + 1))}</ol>
      </li>
    );
  };

  return (
    <section aria-labelledby="timeline-title" className="surface space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="timeline-title" className="text-base font-bold">
            Ruta del curso
          </h2>
          <p className="text-xs text-muted-foreground">
            {completed} de {lessons} lecciones completadas
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Link href={`/admin/courses/${courseId}/outline`} className="btn btn-outline btn-sm">
              Editar estructura
            </Link>
          )}
          {nextLessonId ? (
            <Link href={lessonHref(nextLessonId)} className="btn btn-primary btn-sm">
              {completed ? "Continuar con la siguiente lección →" : "Empezar el curso →"}
            </Link>
          ) : (
            lessons > 0 && <span className="badge bg-tone-brand-soft text-tone-brand"><PartyPopper aria-hidden className="inline size-4 align-[-0.125em]" /> Curso completado</span>
          )}
        </div>
      </div>
      {/* `role="progressbar"` + aria-valuenow (WAI-ARIA): progreso anunciado por el lector de pantalla */}
      <div role="progressbar" aria-label="Progreso del curso" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary motion-safe:transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      {lessons ? (
        <ol className="space-y-5">{outline.levels.map((n) => renderNode(n, 0))}</ol>
      ) : (
        <p className="text-sm text-muted-foreground">Este curso todavía no tiene lecciones publicadas.</p>
      )}
    </section>
  );
}
