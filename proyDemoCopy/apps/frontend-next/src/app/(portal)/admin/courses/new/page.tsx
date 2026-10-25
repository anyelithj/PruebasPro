import type { Metadata } from "next";
import { BackLink } from "@/components/shared/BackLink"; // [2026-10-23]: «Volver» uniforme (icono + texto, encima del título) como en todas las secciones
import { getServerDictionary } from "@/lib/i18n-server";
import { CourseForm } from "../CourseForm"; // [Formulario único]: el mismo que usa la edición
// [Página /admin/courses/new]: alta de curso dentro de Gestión | [Patrón]: Container (RSC) + Presentational (form cliente) | [Principio]: SRP

export const metadata: Metadata = {
  title: "Gestión · Nuevo curso",
  robots: { index: false, follow: false }, // Privada: no indexar
};

export default async function NewCoursePage() {
  const t = await getServerDictionary();
  return (
    <div className="w-full space-y-5 py-4">
      <BackLink href="/admin/courses" memo="courses">{t.adminCourses.back}</BackLink>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t.adminCourses.newTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.adminCourses.newSubtitle}</p>
        </div>
      </header>
      <CourseForm />
    </div>
  );
}
