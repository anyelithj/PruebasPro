import Link from "next/link";
import { isLessonLocked, lessonHref, MATERIAL_ICON, type CourseMaterial } from "@/types/courses";
// [SyllabusList]: lista del temario (Completado / En curso / Bloqueado / Pendiente) compartida por el detalle del curso y la página de la lección
// [Patrón]: Presentational Component (sin estado, sin "use client" → sirve en Server y Client Components) | [Principio]: SRP + DRY | [Paradigma]: Declarativo + Funcional

export interface SyllabusLabels {
  done: string;
  current: string;
  locked: string;
  pending: string;
  lockedHint: string;
  remove: string;
}

export interface SyllabusListProps {
  courseId: string;
  items: ReadonlyArray<CourseMaterial>;
  done: ReadonlySet<string>; // Ids completados
  activeIndex: number; // Paso "En curso": siguiente pendiente (temario) o lección abierta (lección)
  nextPending: number; // Primera lección sin completar (-1 = todas)
  canTrack: boolean; // Alumno inscrito → aplica el bloqueo secuencial
  color: string;
  labels: SyllabusLabels;
  compact?: boolean; // `?` (TS): prop opcional → versión lateral con scroll
  openIndex?: number; // Lección abierta (aria-current)
  onRemove?: (id: string) => void; // Solo ADMIN
}

type StepState = "done" | "current" | "locked" | "pending"; // Unión de literales (TS)

export function SyllabusList({ courseId, items, done, activeIndex, nextPending, canTrack, color, labels, compact, openIndex, onRemove }: SyllabusListProps) {
  return (
    <ol className={compact ? "max-h-[420px] overflow-y-auto" : undefined}>
      {items.map((it, i) => {
        // [Estado del paso]: ternarios encadenados → prioridad Completado > En curso > Bloqueado > Pendiente
        const state: StepState = done.has(it.id) ? "done" : i === activeIndex ? "current" : isLessonLocked(i, nextPending, canTrack) ? "locked" : "pending";
        const locked = state === "locked";
        const accent = state === "done" || state === "current"; // Pasos con el color del curso
        const badge = { done: `✓ ${labels.done}`, current: `▶ ${labels.current}`, locked: labels.locked, pending: labels.pending }[state]; // [Patrón]: Lookup Table
        const rowClass = "flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1.5 py-2.5 text-left transition-colors";
        const content = (
          <>
            <span
              aria-hidden
              className="flex size-[22px] shrink-0 items-center justify-center rounded-full border text-[10px]"
              style={{
                background: accent ? `${color}22` : "var(--nl-surf2)",
                borderColor: accent ? color : "var(--nl-brd)",
                color: accent ? color : "var(--nl-txt2)",
              }}
            >
              {state === "done" ? "✓" : state === "current" ? "▶" : i + 1}
            </span>
            <span
              className={`min-w-0 flex-1 truncate text-xs ${state === "current" ? "font-semibold" : ""} ${state === "done" || locked ? "text-muted-foreground" : ""}`}
              style={state === "current" ? { color } : undefined}
            >
              <span aria-hidden>{MATERIAL_ICON[it.kind]}</span> {it.title}
            </span>
            {/* [Badge de estado]: píldora a la derecha como en el demo */}
            <span
              className="shrink-0 whitespace-nowrap rounded-full border px-2 py-px text-[9px] font-bold"
              style={
                accent
                  ? { color, background: `${color}18`, borderColor: `${color}33` }
                  : { color: "var(--nl-txt2)", background: "var(--nl-surf2)", borderColor: "var(--nl-brd)" }
              }
            >
              {badge}
            </span>
          </>
        );
        return (
          <li key={it.id} className="flex items-center gap-1 border-b border-border last:border-b-0">
            {locked ? (
              // [Bloqueado]: sin enlace (no navegable); `aria-disabled` (WAI-ARIA) + `title` explican por qué
              <span aria-disabled="true" title={labels.lockedHint} className={`${rowClass} cursor-not-allowed`}>
                {content}
              </span>
            ) : (
              // [Navegación = enlace]: <Link> (Next.js) → prefetch, abrir en pestaña nueva y botón "Atrás" del navegador
              <Link
                href={lessonHref(courseId, it.id)}
                aria-current={openIndex === i ? "step" : undefined}
                className={`${rowClass} hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
              >
                {content}
              </Link>
            )}
            {onRemove && (
              <button type="button" onClick={() => onRemove(it.id)} aria-label={`${labels.remove}: ${it.title}`} className="btn btn-ghost btn-sm px-2! text-tone-danger">
                ✕
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
