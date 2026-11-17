import { Library } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis)
import type { CourseResponse } from "@/types/courses";
import { CourseCard } from "./CourseCard";
// [crg · CourseGrid]: grid responsivo de CourseCards con EmptyState | [Patrón]: Composite + Null Object | [Principio]: SRP

export interface CourseGridProps {
  courses: CourseResponse[];
  // [emptyMessage]: texto personalizable cuando lista vacía | [Patrón]: Null Object pattern
  emptyMessage?: string;
}

export function CourseGrid({ courses, emptyMessage }: CourseGridProps) {
  if (courses.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed p-12 text-center"
        style={{
          background: "var(--nl-surf)",
          borderColor: "var(--nl-brd)",
          color: "var(--nl-txt2)",
        }}
        role="status"
        aria-live="polite"
      >
        <div className="text-3xl mb-2" aria-hidden>
          <Library aria-hidden className="mx-auto size-10 text-tone-brand" />
        </div>
        <p>{emptyMessage ?? "No hay cursos en esta categoría."}</p>
      </div>
    );
  }

  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))" }} /* [2026-11-06]: 240 → 300 px: tarjetas más anchas */
    >
      {courses.map((c) => (
        <CourseCard key={c.id} course={c} />
      ))}
    </div>
  );
}
