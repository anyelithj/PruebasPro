import type { Metadata } from "next";
import { getMyProfile } from "@/lib/profile-api"; // [2026-11-03]: perfil del instructor
import { SOCIAL_NETWORKS, socialUrlField } from "@/types/profile";
import { BackLink } from "@/components/shared/BackLink"; // [2026-10-23]: «Volver» uniforme (icono + texto, encima del título) como en todas las secciones
import { notFound } from "next/navigation";
import { getCourse, listCourseMaterials } from "@/lib/courses-api";
import { ApiError } from "@/lib/errors";
import { getServerDictionary } from "@/lib/i18n-server";
import { getCurrentUserPayload } from "@/lib/auth";
import { canManageCourse } from "@/lib/course-access"; // [2026-10-27]: ADMIN o docente dueño
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
  const [course, materials, t, user] = await Promise.all([
    getCourse(id).catch((err: unknown) => {
      if (err instanceof ApiError && err.status === 404) notFound(); // `notFound()` (Next.js): página 404
      throw err;
    }),
    listCourseMaterials(id).catch(() => []),
    getServerDictionary(),
    getCurrentUserPayload(),
  ]);
  // [Guard de propiedad · 2026-10-27]: un docente que no creó el curso (o un estudiante) no ve el formulario → 404 | el backend igual responde 403 al guardar
  if (!canManageCourse(course, user)) notFound();
  // [Perfil del instructor · 2026-11-03]: el autor lo edita aquí (su perfil); un ADMIN que edita el curso de otro lo ve de solo lectura (author del curso)
  const own = user?.sub === course.createdBy;
  const me = own ? await getMyProfile().catch(() => null) : null;
  const instructorProfile = own && me
    ? { bio: me.bio ?? "", social: Object.fromEntries(SOCIAL_NETWORKS.map((n) => [socialUrlField(n), me[socialUrlField(n)] ?? ""])), editable: true }
    : { bio: course.author?.bio ?? "", social: Object.fromEntries(SOCIAL_NETWORKS.map((n) => [socialUrlField(n), course.author?.social?.[n] ?? ""])), editable: false };

  return (
    <div className="w-full space-y-5 py-4">
      <BackLink href="/admin/courses" memo="courses">{t.adminCourses.back}</BackLink>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="title-page">{t.adminCourses.editTitle}</h1>
          <p className="mt-1 text-muted-foreground">{t.adminCourses.editSubtitle}</p>
        </div>
        {/* [2026-11-16]: sin botón «Estructura (lecciones)» — el temario del formulario ya organiza el curso */}
      </header>
      {/* `key` (React): si cambia la versión del curso, el formulario se reinicia con los datos nuevos */}
      <CourseForm key={course.updatedAt} initial={course} initialMaterials={materials} instructorProfile={instructorProfile} />
    </div>
  );
}
