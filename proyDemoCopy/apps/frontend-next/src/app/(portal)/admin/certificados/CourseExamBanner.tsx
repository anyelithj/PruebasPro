import Link from "next/link";
import { getExamManage } from "@/lib/quiz-api";
// [CourseExamBanner · 2026-11-09]: Gestión → Exámenes con ?curso=<id> (tras crear/editar un curso) → revisar su examen final
// [2026-11-10 · «este mensaje sobra»]: sin examen no se muestra nada → «Publicar» deshabilitado (con el motivo) y «Crear examen» ya lo dicen

export async function CourseExamBanner({ courseId }: { courseId: string }) {
  const row = (await getExamManage().catch(() => [])).find((r) => r.courseId === courseId);
  if (!row?.quizId) return null;
  return (
    <section role="status" className="surface flex flex-wrap items-center gap-3 border-l-4 border-l-primary p-4">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Examen final del curso «{row.courseTitle}»</p>
        <p className="type-meta text-muted-foreground">
          Ya tiene examen ({row.questions} preguntas en el banco). Revísalo o edítalo; los alumnos lo ven bloqueado hasta completar el curso al 100 %.
        </p>
      </div>
      <span className="flex flex-wrap gap-2">
        {/* [2026-11-11]: a la ficha del examen (de ahí se edita), no directo al editor */}
        <Link href={`/quiz/${row.quizId}`} className="btn btn-primary btn-sm">Ver y revisar preguntas</Link>
      </span>
    </section>
  );
}
