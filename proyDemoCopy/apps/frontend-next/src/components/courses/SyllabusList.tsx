import type { CSSProperties } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
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
  timeline?: boolean; // [2026-10-31]: línea de tiempo como «Subtemas» (página de la lección)
  openIndex?: number; // Lección abierta (aria-current)
  onRemove?: (id: string) => void; // Solo ADMIN
}

type StepState = "done" | "current" | "locked" | "pending"; // Unión de literales (TS)

// [Píldora de estado · 2026-10-31]: «▶ En curso» de Recursos, compartida con «Subtemas» (LessonSyllabus) | [Principio]: DRY + SSOT
export const STATUS_PILL = "shrink-0 whitespace-nowrap rounded-full border px-2 py-px text-[9px] font-bold";
export const statusPillStyle = (color: string) => ({ color, background: `${color}18`, borderColor: `${color}33` });

// [Nodo de la línea de tiempo · 2026-10-31]: relleno = completado · anillo = abierto · hueco = pendiente | colores del curso con alfa hex | [Principio]: DRY (Subtemas y Recursos) | Función pura
export const timelineDotStyle = (state: "done" | "current" | "pending", ring: boolean, color: string): CSSProperties => ({
  background: state === "done" ? color : "var(--nl-surf)",
  borderColor: state === "pending" ? "var(--nl-brd)" : color,
  color: state === "done" ? "#fff" : state === "current" ? color : "var(--nl-txt2)",
  boxShadow: ring ? `0 0 0 4px ${color}2e` : undefined,
});

export function SyllabusList({ courseId, items, done, activeIndex, nextPending, canTrack, color, labels, timeline, openIndex, onRemove }: SyllabusListProps) {
  return (
    <ol>
      {items.map((it, i) => {
        // [Estado del paso]: ternarios encadenados → prioridad Completado > En curso > Bloqueado > Pendiente
        const state: StepState = done.has(it.id) ? "done" : i === activeIndex ? "current" : isLessonLocked(i, nextPending, canTrack) ? "locked" : "pending";
        const locked = state === "locked";
        const accent = state === "done" || state === "current"; // Pasos con el color del curso
        const badge = { done: `✓ ${labels.done}`, current: `▶ ${labels.current}`, locked: labels.locked, pending: labels.pending }[state]; // [Patrón]: Lookup Table
        // [Línea de tiempo · 2026-10-31]: mismos nodo, conector y píldora que «Subtemas» | <li> relative + conector absolute | el estado va en TEXTO además del color (WCAG 1.4.1)
        if (timeline) {
          const last = i === items.length - 1;
          const open = openIndex === i;
          const row = cn("flex w-full items-start gap-2 rounded-lg px-2 py-1 text-left", open && "bg-muted");
          const body = (
            <>
              <span className="min-w-0 flex-1 text-sm font-semibold" style={open ? { color } : undefined}>
                <span aria-hidden>{MATERIAL_ICON[it.kind]}</span> {it.title}
              </span>
              <span className={cn(STATUS_PILL, "mt-0.5")} style={statusPillStyle(color)}>
                {badge}
              </span>
            </>
          );
          return (
            <li key={it.id} className={cn("relative pl-9", !last && "pb-4")}>
              {!last && <span aria-hidden className="absolute bottom-0 left-[11px] top-7 w-0.5 rounded-full motion-safe:transition-colors" style={{ background: state === "done" ? color : "var(--nl-brd)" }} />}
              <span aria-hidden className="absolute left-0 top-1 grid size-6 place-items-center rounded-full border-2 text-[11px] font-bold motion-safe:transition-all" style={timelineDotStyle(state === "done" || state === "current" ? state : "pending", open, color)}>
                {state === "done" ? "✓" : i + 1}
              </span>
              {locked ? (
                <span aria-disabled="true" title={labels.lockedHint} className={cn(row, "cursor-not-allowed opacity-60")}>
                  {body}
                </span>
              ) : (
                <Link href={lessonHref(courseId, it.id)} aria-current={open ? "step" : undefined} className={cn(row, "transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}>
                  {body}
                </Link>
              )}
            </li>
          );
        }
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
              className={STATUS_PILL}
              style={accent ? statusPillStyle(color) : { color: "var(--nl-txt2)", background: "var(--nl-surf2)", borderColor: "var(--nl-brd)" }}
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
