import { BackLink } from "@/components/shared/BackLink"; // [2026-10-23]: enlace «volver» uniforme (icono + texto)
import type { Metadata } from "next";
import { CurriculumItemForm } from "@/components/curriculum/CurriculumItemForm";
import { getCurrentUserPayload } from "@/lib/auth";
import { Role } from "@/lib/constants";
import { searchCurriculumSources } from "@/lib/curriculum-api";
// [Página /admin/curriculum/new]: plantilla que compone el organismo de formulario | [Patrón]: Atomic Design (Page) + Container | [Principio]: SRP | [Tecnología]: Next.js Server Component que renderiza un Client Component

export const metadata: Metadata = {
  title: "Crear recurso",
  robots: { index: false, follow: false },
};

export default async function NewCurriculumItemPage() {
  // [Precarga en servidor]: rol (solo UX; el backend autoriza) y fuente "Contenido propio" (primera por orden)
  const [user, sources] = await Promise.all([getCurrentUserPayload(), searchCurriculumSources({ limit: 1 }).catch(() => [])]);
  const ownSource = sources.find((s) => s.isOwnContent) ?? null;
  return (
    <div className="w-full space-y-5 py-4">{/* <div>: el layout ya aporta el <main> */}
      <BackLink href="/admin/curriculum" memo="content">Volver a recursos</BackLink>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Crear recurso</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuatro pasos: tipo, destinatario, contenido y origen. Se guarda como borrador hasta que se publique.
          </p>
        </div>
      </header>
      <CurriculumItemForm canAdmin={user?.role === Role.ADMIN} ownSource={ownSource} />
    </div>
  );
}
