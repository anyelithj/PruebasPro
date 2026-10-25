import { BackLink } from "@/components/shared/BackLink"; // [2026-10-23]: enlace «volver» uniforme (icono + texto)
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCourse, listCourseMaterials } from "@/lib/courses-api";
import { getCurrentUserPayload } from "@/lib/auth";
import { Role } from "@/lib/constants";
import { ApiError } from "@/lib/errors";
import { getServerDictionary } from "@/lib/i18n-server";
import { CourseLesson } from "@/components/courses/CourseLesson";
import { isLessonLocked, lessonHref, nextPendingIndex } from "@/types/courses";
// [Página /courses/:id/lessons/:materialId]: pantalla propia de la lección (como openLesson del demo) — el detalle del curso solo muestra el temario
// [Patrón]: Container (RSC carga datos) + Guard (acceso y desbloqueo en el servidor) | [Principio]: SRP + Seguridad en profundidad | [Paradigma]: Declarativo + Asíncrono

interface PageProps {
  params: Promise<{ id: string; materialId: string }>; // `Promise` (Next.js 15+): params asíncronos
}

// [SEO]: contenido privado de pago → sin indexar
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function LessonPage(props: PageProps) {
  const { id, materialId } = await props.params;
  let course;
  try {
    course = await getCourse(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound(); // `notFound()` (Next.js): renderiza not-found.tsx
    throw err;
  }

  // [Carga en paralelo]: `Promise.all` (ES2015) → materiales, usuario y textos a la vez
  const [materials, user, t] = await Promise.all([listCourseMaterials(course.id).catch(() => []), getCurrentUserPayload(), getServerDictionary()]);
  const isAdmin = user?.role === Role.ADMIN;
  // [Guard de acceso]: sin compra/inscripción ni rol ADMIN → vuelve al detalle (el backend igualmente responde 403 al servir el archivo)
  if (!course.hasAccess && !isAdmin) redirect(`/courses/${encodeURIComponent(course.id)}`);

  const index = materials.findIndex((x) => x.id === materialId);
  if (index === -1) notFound();

  // [Guard de desbloqueo]: un alumno no puede saltarse lecciones escribiendo la URL → se le lleva a la primera pendiente
  const canTrack = Boolean(course.hasAccess);
  const done = new Set(course.completedMaterialIds ?? []);
  const nextPending = nextPendingIndex(materials, done);
  if (isLessonLocked(index, nextPending, canTrack)) redirect(lessonHref(course.id, materials[nextPending].id));

  const m = t.courses.materials;
  return (
    <div className="fade-in w-full space-y-5 py-4">
      {/* [Breadcrumb]: <nav> + <ol> + aria-current="page" (patrón WAI-ARIA) → Curso / Lección */}
      <nav aria-label={m.breadcrumb}>
        <ol className="flex flex-wrap items-center gap-2 text-[13px]" style={{ color: "var(--nl-txt2)" }}>
          <li>
            <BackLink href={`/courses/${encodeURIComponent(course.id)}`}>Volver al curso</BackLink>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="font-semibold" style={{ color: course.color }}>
            {materials[index].title}
          </li>
        </ol>
      </nav>

      <CourseLesson
        key={materialId} // Nueva lección → estado limpio (errores, optimismo)
        courseId={course.id}
        items={materials}
        index={index}
        initialCompleted={course.completedMaterialIds ?? []}
        canTrack={canTrack}
        color={course.color}
        lang={course.icon.toLowerCase()} // `icon` = código ISO 639-1 del idioma del curso ("FR" → "fr")
      />
    </div>
  );
}
