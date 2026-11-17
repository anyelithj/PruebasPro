import type { Metadata } from "next";
import { BackLink } from "@/components/shared/BackLink";
import { ExamStatusCard } from "@/components/quiz/ExamStatusCard";
// [FinalExamPage · 2026-11-06]: /quiz/examen/curso/:courseId — examen final del curso (se genera solo al llegar al 100 %) → aprobar emite el certificado

export const metadata: Metadata = { title: "Examen final", robots: { index: false, follow: false } };

// [2026-11-11 · Volver según el origen]: ?desde=curso → al curso · si no → a la sección Exámenes (con sus filtros: memo «exams»)
export default async function FinalExamPage(props: { params: Promise<{ courseId: string }>; searchParams: Promise<{ desde?: string }> }) {
  const [{ courseId }, { desde }] = await Promise.all([props.params, props.searchParams]);
  const fromCourse = desde === "curso";
  return (
    <div className="w-full space-y-5 py-4"> {/* [2026-11-11]: MISMO ancho que el resto del portal (antes centrado a 768 px) */}
      {fromCourse ? <BackLink href={`/courses/${encodeURIComponent(courseId)}`}>Volver al curso</BackLink> : <BackLink href="/quiz" memo="exams">Volver a exámenes</BackLink>}
      <h1 className="title-page">Examen final del curso</h1>
      <ExamStatusCard endpoint={`/api/quiz/exams/course/${encodeURIComponent(courseId)}`} kind="final" playQuery={fromCourse ? "?desde=curso" : ""} />
    </div>
  );
}
