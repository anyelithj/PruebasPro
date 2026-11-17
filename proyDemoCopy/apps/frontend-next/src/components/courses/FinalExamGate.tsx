"use client";
import { Lock, NotebookPen } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useCourseProgress } from "./CourseProgressProvider";

// [FinalExamGate · 2026-11-09]: examen final al pie del temario — bloqueado hasta el 100 %;
// si el alumno llega al 100 % en esta visita, lo lleva al examen | [Patrón]: Gate (UI condicionada al progreso)
export function FinalExamGate({ courseId, color }: { courseId: string; color: string }) {
  const { progress, preview } = useCourseProgress();
  const router = useRouter();
  const href = `/quiz/examen/curso/${encodeURIComponent(courseId)}?desde=curso`; // [2026-11-11]: «Volver» del examen → al curso
  const unlocked = progress.pct >= 100;
  const startPct = useRef(progress.pct); // progreso al abrir la página → solo redirige si cruza el 100 % ahora

  useEffect(() => {
    if (!preview && unlocked && startPct.current < 100) router.push(href);
  }, [unlocked, preview, href, router]);

  return (
    <section aria-labelledby="final-exam" className="surface flex flex-wrap items-center gap-4 border-l-4 p-5" style={{ borderColor: color }}>
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted">
        {unlocked ? <NotebookPen aria-hidden className="size-5 text-tone-brand" /> : <Lock aria-hidden className="size-5 text-muted-foreground" />}
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <h2 id="final-exam" className="font-semibold">
          Examen final del curso {!unlocked && <span className="badge ml-1 bg-muted text-muted-foreground align-middle">🔒 Bloqueado</span>}
        </h2>
        <p className="type-meta text-muted-foreground">
          {unlocked ? "¡Completaste el curso! Apruébalo para obtener tu certificado." : `Completa el curso al 100 % para desbloquearlo (vas en ${progress.pct} %).`}
        </p>
        {!unlocked && (
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avance del curso">
            <div className="h-full bg-primary transition-[width]" style={{ width: `${progress.pct}%` }} />
          </div>
        )}
      </div>
      {unlocked ? (
        <Link href={href} className="btn btn-primary btn-sm">Presentar examen</Link>
      ) : (
        <button type="button" className="btn btn-outline btn-sm" disabled aria-disabled>Presentar examen</button>
      )}
    </section>
  );
}
