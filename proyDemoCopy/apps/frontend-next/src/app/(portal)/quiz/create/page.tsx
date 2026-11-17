import type { Metadata } from "next";
import { BackLink } from "@/components/shared/BackLink"; // [2026-10-23]: «Volver a …» uniforme encima del título
import { QuizForm, type QuizFormPreset } from "@/components/quiz/QuizForm"; // [Formulario único]: el mismo que usa la edición
import { getCourse } from "@/lib/courses-api";
import { getExamManage } from "@/lib/quiz-api";
import { DEFAULT_LANGUAGE, LANGUAGE_VALUES } from "@/lib/languages";
import { parseSyllabus, serializeSyllabus } from "@/lib/syllabus";
// [Página crear examen]: cabecera + formulario compartido | [Patrón]: Container (RSC) + Presentational | [Principio]: SRP + DRY
// [2026-11-09 · ?curso=<id>]: desde el borrador del curso → examen FINAL de ese curso con los subtemas ya puestos; al guardar vuelve al curso para publicarlo
// [2026-11-10]: una sola cabecera «Crear examen» (antes «Crear examen final» aquí y «Crear examen» en Gestión) | sin banner ni «Generar con IA» aparte

export const metadata: Metadata = {
  title: "Crear examen",
  robots: { index: false, follow: false }, // Privada: no indexar
};

export default async function CreateQuizPage(props: { searchParams: Promise<{ curso?: string }> }) {
  const { curso } = await props.searchParams;
  const course = curso ? await getCourse(curso).catch(() => null) : null;
  let preset: QuizFormPreset | undefined;
  if (course) {
    const topics = parseSyllabus(course.content);
    preset = {
      courseId: course.id,
      title: `Examen final · ${course.title}`.slice(0, 160),
      description: `Examen final del curso «${course.title}» (${course.level}). Aprueba con 70 % o más para obtener el certificado.`,
      language: LANGUAGE_VALUES.find((l) => l === String(course.group).toLowerCase()) ?? DEFAULT_LANGUAGE,
      topic: topics.map((t) => t.title).join(", ").slice(0, 2000), // [2026-11-10]: TODOS los subtemas («## …») → el «Tema» de la IA (área de texto)
      cefr: course.level, // [2026-11-10]: el Nivel MCER del examen = el del curso
      source: serializeSyllabus(topics).slice(0, 6000),
    };
  }
  // [2026-11-11]: sin curso → cursos que aún no tienen examen final (para «Examen final de curso»)
  const finalCourses = course ? [] : (await getExamManage().catch(() => [])).filter((r) => !r.quizId);
  return (
    <div className="w-full space-y-5 py-4">
      {course ? <BackLink href={`/courses/${encodeURIComponent(course.id)}`}>Volver al curso</BackLink> : <BackLink href="/quiz" memo="exams">Volver a exámenes</BackLink>}
      <header>
        <h1 className="title-page">Crear examen</h1>
        <p className="mt-1 text-muted-foreground">
          {course
            ? `Examen final del curso «${course.title}»: las preguntas salen de los subtemas de su temario (ya cargados). Al guardarlo vuelves al curso para publicarlo.`
            : "Define idioma, competencia y nivel MCER. Las preguntas van en el idioma objetivo y las explicaciones en español. Puedes crearlas manualmente o generarlas con IA."}
        </p>
      </header>
      <QuizForm preset={preset} finalCourses={finalCourses} />
    </div>
  );
}
