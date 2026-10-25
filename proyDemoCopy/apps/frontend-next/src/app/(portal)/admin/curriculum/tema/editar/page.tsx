import { BackLink } from "@/components/shared/BackLink"; // [2026-10-23]: enlace «volver» uniforme (icono + texto)
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listCurriculum } from "@/lib/curriculum-api";
import { getCurrentUserPayload } from "@/lib/auth";
import { Role } from "@/lib/constants";
import { CurriculumItemForm } from "@/components/curriculum/CurriculumItemForm";
import { groupQuery, KINDS, type CurriculumItemKind } from "@/types/curriculum";
// [Página /admin/curriculum/tema/editar]: edita un TEMA completo — los elementos existentes se cargan en el mismo formulario del alta y se pueden AÑADIR más (a mano o con IA)
// [Patrón]: Container (RSC) + reutilización del organismo CurriculumItemForm en "modo tema" | [Principio]: DRY + OCP | [Paradigma]: Declarativo

export const metadata: Metadata = { title: "Gestión · Editar tema", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function EditTopicPage(props: { searchParams: Promise<{ topic?: string; language?: string; level?: string; kind?: string }> }) {
  const [sp, user] = await Promise.all([props.searchParams, getCurrentUserPayload()]);
  const kind = KINDS.includes(sp.kind as CurriculumItemKind) ? (sp.kind as CurriculumItemKind) : undefined;
  if (!sp.topic || !kind) notFound(); // `notFound()` (Next.js): sin tema o tipo no hay nada que editar
  const { data: items } = await listCurriculum({ topic: sp.topic, language: sp.language, level: sp.level, kind, limit: 100 });
  if (!items.length) notFound();
  const q = groupQuery({ topic: sp.topic, language: sp.language ?? "", level: sp.level ?? "", kind });

  return (
    <div className="w-full space-y-5 py-4">
      <BackLink href={`/admin/curriculum/tema?${q}`}>Volver al tema</BackLink>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Editar tema: {sp.topic}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length} elementos. Modifica los existentes o añade más; al guardar se crean los nuevos y se actualizan solo los que cambiaste.
          </p>
        </div>
      </header>
      <CurriculumItemForm canAdmin={user?.role === Role.ADMIN} initialGroup={items} />
    </div>
  );
}
