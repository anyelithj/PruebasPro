import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "@/components/shared/BackLink"; // [2026-10-23]: «Volver» uniforme (icono + texto, encima del título) como en todas las secciones
import { notFound } from "next/navigation";
import { getCourse, listCourseMaterials } from "@/lib/courses-api";
import { ApiError } from "@/lib/errors";
import { getServerDictionary } from "@/lib/i18n-server";
import { CourseForm } from "../../CourseForm"; // [Formulario único]: el mismo del alta, con `initial`
// [Página /admin/courses/:id/edit]: edición de curso con el MISMO formulario del alta | [Patrón]: Container (RSC) + Presentational (form cliente) | [Principio]: SRP + DRY

export const metadata: Metadata = {
  title: "Gestión · Editar curso",
  robots: { index: false, follow: false }, // Privada: no indexar
};

export const dynamic = "force-dynamic"; // Depende de la sesión → render por petición

export default async function EditCoursePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  // `Promise.all` (ES2015): curso, materiales y textos en paralelo | `.catch(() => [])`: sin materiales no se rompe la página
  const [course, materials, t] = await Promise.all([
    getCourse(id).catch((err: unknown) => {
      if (err instanceof ApiError && err.status === 404) notFound(); // `notFound()` (Next.js): página 404
      throw err;
    }),
    listCourseMaterials(id).catch(() => []),
    getServerDictionary(),
  ]);

  return (
    <div className="w-full space-y-5 py-4">
      <BackLink href="/admin/courses" memo="courses">{t.adminCourses.back}</BackLink>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t.adminCourses.editTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.adminCourses.editSubtitle}</p>
        </div>
        <div className="flex gap-2">
          {/* [Etapa 3]: estructura Nivel → Módulo → Unidad → Lección del mismo curso */}
          <Link href={`/admin/courses/${id}/outline`} className="btn btn-primary">
            Estructura (lecciones)
          </Link>
        </div>
      </header>
      {/* `key` (React): si cambia la versión del curso, el formulario se reinicia con los datos nuevos */}
      <CourseForm key={course.updatedAt} initial={course} initialMaterials={materials} />
    </div>
  );
}
