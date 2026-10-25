import { BackLink } from "@/components/shared/BackLink"; // [2026-10-23]: enlace «volver» uniforme (icono + texto)
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourse } from "@/lib/courses-api";
import { getCourseOutline } from "@/lib/curriculum-api";
import { getCurrentUserPayload } from "@/lib/auth";
import { Role } from "@/lib/constants";
import { ApiError } from "@/lib/errors";
import { CourseOutlineEditor } from "@/components/courses/CourseOutlineEditor";
// [Página /admin/courses/:id/outline]: editor de la estructura Nivel → Módulo → Unidad → Lección | [Patrón]: Container (RSC) + editor cliente | [Principio]: SRP | [Seguridad]: docente o admin (el backend también lo exige)

export const metadata: Metadata = { title: "Gestión · Estructura del curso", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic"; // Depende de la sesión → render por petición

export default async function CourseOutlinePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await getCurrentUserPayload();
  if (user?.role !== Role.ADMIN && user?.role !== Role.TEACHER) notFound(); // Estudiantes: la página no existe para ellos
  const [course, outline] = await Promise.all([
    getCourse(id).catch((err: unknown) => {
      if (err instanceof ApiError && err.status === 404) notFound();
      throw err;
    }),
    getCourseOutline(id),
  ]);

  return (
    <div className="w-full space-y-5 py-4">
      <BackLink href="/admin/courses" memo="courses">Volver a cursos</BackLink>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Estructura del curso</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {course.title} · organiza niveles, módulos, unidades y lecciones. Al guardar se reutilizan los recursos que ya existen (mismo idioma, nivel, tipo y
            tema); solo las lecciones vacías se pueden generar con IA.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/courses/${id}#timeline-title`} className="btn btn-ghost">
            Ver como estudiante
          </Link>
        </div>
      </header>
      {/* `key`: al cambiar el árbol guardado, el editor se reinicia con los ids nuevos */}
      <CourseOutlineEditor key={JSON.stringify(outline.summary)} courseId={id} initial={outline} />
    </div>
  );
}
