import type { Metadata } from "next"; // [Next.js]: Metadata API | `import type` (TS): se borra al compilar
import { notFound } from "next/navigation";
import { BackLink } from "@/components/shared/BackLink";
import { ActivityEditForm } from "@/components/activities/ActivityEditForm";
import { apiFetch } from "@/lib/api-client";
import { getCurrentAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { languageLabel } from "@/lib/languages";
import { ACTIVITY_KINDS, isCreatableKind } from "@/lib/activity-kinds";
// [Página /admin/activities/editar/[tab]/[id] · 2026-10-27]: «Editar» de Práctica y Diálogos en Next.js — antes saltaba al editor del remoto Angular (otra interfaz y otro «Volver»)
// [Patrón]: Container (RSC: carga con el token en el servidor) + Presentational (ActivityEditForm, cliente) + Strategy (ACTIVITY_KINDS[tab].edit) | [Principio]: SRP + mínimo privilegio (NestJS decide quién edita) | [SEO]: privada

export const metadata: Metadata = { title: "Editar actividad", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic"; // Siempre el contenido actual

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditActivityPage(props: { params: Promise<{ tab: string; id: string }> }) {
  const { tab, id } = await props.params; // [Next.js 16]: `params` es una Promise
  const spec = isCreatableKind(tab) ? ACTIVITY_KINDS[tab].edit : undefined;
  if (!spec || !isCreatableKind(tab) || !UUID.test(id)) notFound(); // [Fail Fast]: sección sin editor de Next.js o id inválido → 404 sin llamar a NestJS
  let raw: unknown;
  try {
    raw = await apiFetch<unknown>(spec.path(id), { bearer: (await getCurrentAccessToken()) ?? undefined });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 403)) notFound();
    throw err; // Otros errores → error.tsx del portal
  }
  if ((raw as { editable?: boolean }).editable === false) notFound(); // Diálogos: solo el autor o un ADMIN (NestJS vuelve a comprobarlo al guardar)
  const { draft, ctx } = spec.load(raw);
  const review = `/admin/activities/ver/${tab}/${encodeURIComponent(id)}`;

  return (
    <div className="w-full space-y-5 py-4">
      {/* [2026-11-13]: como «Editar curso» → «Volver» lleva DIRECTO al listado de la pestaña (Cancelar sigue volviendo a la revisión) */}
      <BackLink href={`/admin/activities?tab=${tab}`} memo="activities">
        Volver a {ACTIVITY_KINDS[tab].label.toLowerCase()}
      </BackLink>
      <header>
        <h1 className="title-page">Editar {ACTIVITY_KINDS[tab].label.toLowerCase()}</h1>
        <p className="mt-1 text-muted-foreground">{draft.title} · los cambios se guardan sin cambiar el estado de publicación.</p>
      </header>
      <ActivityEditForm kind={tab} id={id} initial={draft} ctx={ctx} languageName={languageLabel(ctx.language)} backHref={review} />
    </div>
  );
}
