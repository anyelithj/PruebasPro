import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/shared/BackLink";
import { RowActions } from "@/components/admin/RowActions";
import { ACTIVITY_TAB_KEYS, ACTIVITY_TABS, listActivities, STATUS_LABEL, withReturn, type ActivityTab } from "@/lib/activities-api";
import { languageLabel } from "@/lib/languages";
import { setActivityPublishedAction } from "../../../actions";
// [Página /admin/activities/ver/[tab]/[id] · 2026-10-25]: tras crear una actividad se llega AQUÍ (como en Recursos) → vista previa tal como la verá el estudiante
// + estado (Borrador/Publicada) + Publicar · Editar. Todo se crea en borrador y solo se publica tras revisarlo
// [Patrón]: Container (RSC) + Reuse (RowActions, listActivities) | [Principio]: DRY | iframe: la pantalla del estudiante es del remoto Angular (mismo origen)

export const metadata: Metadata = { title: "Revisar actividad", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ActivityReviewPage(props: { params: Promise<{ tab: string; id: string }> }) {
  const { tab, id } = await props.params;
  if (!ACTIVITY_TAB_KEYS.includes(tab as ActivityTab)) notFound();
  const t = tab as ActivityTab;
  const def = ACTIVITY_TABS[t];
  const row = (await listActivities(t, "mine").catch(() => [])).find((r) => r.id === id);
  if (!row) notFound();
  const published = row.status === "published";
  const listHref = `/admin/activities?tab=${t}`;

  return (
    <div className="w-full space-y-4 py-4">
      <BackLink href={listHref} memo="activities">Volver a {def.label.toLowerCase()}</BackLink>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{row.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {def.label}
            {row.language ? ` · ${languageLabel(row.language)}` : ""}
            {row.level ? ` · ${row.level}` : ""}
            {" · "}
            <span className={`badge ${published ? "bg-tone-brand-soft text-tone-brand" : "bg-tone-warning-soft text-tone-warning"}`}>{STATUS_LABEL[row.status ?? "draft"] ?? row.status}</span>
          </p>
          {!published && <p className="mt-1 text-xs text-muted-foreground">Revisa la vista previa: cuando esté bien, pulsa «Publicar» y aparecerá en Actividades para los estudiantes.</p>}
          {!published && row.blockers?.length ? <p className="mt-1 text-xs text-tone-warning">Para publicar falta: {row.blockers.join(", ")}.</p> : null}
        </div>
        <RowActions
          hard
          title={row.title}
          editHref={row.editHref ? withReturn(row.editHref, t) : undefined}
          publish={def.publish && (published || !row.blockers?.length) ? { isPublished: published, toggle: setActivityPublishedAction.bind(null, t, row.id, !published) } : undefined}
          deleteTitle={`Eliminar «${row.title}»`}
        />
      </header>
      {/* Vista previa: la misma pantalla que verá el estudiante */}
      <iframe src={row.viewHref} title={`Vista previa: ${row.title}`} className="h-[75vh] w-full rounded-xl border border-border bg-card" />
    </div>
  );
}
