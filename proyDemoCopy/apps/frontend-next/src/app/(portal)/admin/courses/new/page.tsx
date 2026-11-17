import type { Metadata } from "next";
import { BackLink } from "@/components/shared/BackLink"; // [2026-10-23]: «Volver» uniforme (icono + texto, encima del título) como en todas las secciones
import { getServerDictionary } from "@/lib/i18n-server";
import { getCurrentUserPayload } from "@/lib/auth";
import { CourseForm } from "../CourseForm";
// [Página /admin/courses/new]: alta de curso dentro de Gestión | [Patrón]: Container (RSC) + Presentational (form cliente) | [Principio]: SRP

export const metadata: Metadata = {
  title: "Gestión · Nuevo curso",
  robots: { index: false, follow: false }, // Privada: no indexar
};

export default async function NewCoursePage() {
  const [t, user] = await Promise.all([getServerDictionary(), getCurrentUserPayload()]);
  // [2026-11-09]: curso nuevo → perfil del instructor VACÍO (antes se rellenaba con «Mi perfil»); lo que quede vacío no pisa el perfil guardado
  const instructorProfile = { bio: "", social: {}, editable: true };
  return (
    <div className="w-full space-y-5 py-4">
      <BackLink href="/admin/courses" memo="courses">{t.adminCourses.back}</BackLink>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="title-page">{t.adminCourses.newTitle}</h1>
          <p className="mt-1 text-muted-foreground">{t.adminCourses.newSubtitle}</p>
        </div>
      </header>
      <CourseForm instructorProfile={instructorProfile} />
    </div>
  );
}
