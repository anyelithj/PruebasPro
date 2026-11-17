import { BackLink } from "@/components/shared/BackLink";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCourse, listCourseMaterials } from "@/lib/courses-api";
import { getCurrentUserPayload } from "@/lib/auth";
import { Role } from "@/lib/constants";
import { ApiError } from "@/lib/errors";
import { canManageCourse } from "@/lib/course-access";
import { LessonSyllabus } from "@/components/courses/LessonSyllabus";
import { CourseProgressProvider } from "@/components/courses/CourseProgressProvider";
import { FinalExamGate } from "@/components/courses/FinalExamGate";
import { getCourseOutline } from "@/lib/curriculum-api";
import { parseSyllabus } from "@/lib/syllabus";
import { lessonHref, nextPendingIndex } from "@/types/courses";
// [Página /courses/:id/temario · 2026-11-03]: el TEMARIO en su propia ruta (antes compartía página con «Materiales adicionales» en /lessons/:materialId)
// «Iniciar curso» (Acceso al curso) lleva aquí · «Resumen» lleva a los materiales | [Patrón]: Container (RSC) + Guard (acceso en el servidor) | [Principio]: SRP (una página = una sección)

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { robots: { index: false, follow: false } }; // Contenido privado de pago

export default async function SyllabusPage(props: PageProps) {
  const { id } = await props.params;
  let course;
  try {
    course = await getCourse(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const [materials, user, outline] = await Promise.all([
    listCourseMaterials(course.id).catch(() => []),
    getCurrentUserPayload(),
    getCourseOutline(course.id).catch(() => null),
  ]);
  const isAdmin = user?.role === Role.ADMIN;
  const canManage = canManageCourse(course, user);
  // [Guard]: sin acceso (compra/inscripción) ni gestión del curso → vuelve al detalle
  if (!course.hasAccess && !canManage) redirect(`/courses/${encodeURIComponent(course.id)}`);

  const topicTitles = parseSyllabus(course.content).map((x) => x.title);
  const canTrack = Boolean(course.hasAccess);
  const done = new Set(course.completedMaterialIds ?? []);
  const firstMaterial = materials.length ? materials[nextPendingIndex(materials, done)] : null;
  const lessons = outline?.summary.lessons ? { done: outline.summary.completed, total: outline.summary.lessons } : undefined;
  const detail = `/courses/${encodeURIComponent(course.id)}`;

  return (
    <CourseProgressProvider
      courseId={course.id}
      materialIds={materials.map((x) => x.id)}
      topicTitles={topicTitles}
      initialMaterials={course.completedMaterialIds ?? []}
      initialTopics={course.completedTopics ?? []}
      lessons={lessons}
      canTrack={canTrack}
      preview={isAdmin && !canTrack}
    >
      <div className="fade-in w-full space-y-6 py-4">
        <nav aria-label="Ruta de navegación">
          <ol className="flex flex-wrap items-center gap-2 text-[13px]" style={{ color: "var(--nl-txt2)" }}>
            <li>
              <BackLink href={detail}>Volver al curso</BackLink>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="font-semibold" style={{ color: course.color }}>
              Temario
            </li>
          </ol>
        </nav>

        <header className="flex flex-wrap items-end justify-between gap-3 border-l-4 pl-3" style={{ borderColor: course.color }}>
          <div className="space-y-1">
            <p className="type-meta font-semibold uppercase tracking-wide text-muted-foreground">
              <span aria-hidden className="font-mono">{course.icon}</span> · {course.level}
            </p>
            <h1 className="title-page">{course.title}</h1>
          </div>
          {/* [Cambio de sección]: Temario ⇄ Materiales adicionales (rutas separadas) */}
          {firstMaterial && (
            <Link href={lessonHref(course.id, firstMaterial.id)} className="btn btn-outline btn-sm">
              Materiales adicionales →
            </Link>
          )}
        </header>

        {topicTitles.length ? (
          <LessonSyllabus content={course.content} color={course.color} lang={course.icon.toLowerCase()} />
        ) : (
          <p className="surface p-5 text-center text-muted-foreground">Este curso aún no tiene temario.</p>
        )}

        {/* [2026-11-09]: examen final bloqueado hasta completar el 100 % */}
        <FinalExamGate courseId={course.id} color={course.color} />
      </div>
    </CourseProgressProvider>
  );
}
