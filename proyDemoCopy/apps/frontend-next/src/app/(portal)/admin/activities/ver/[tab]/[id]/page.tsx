import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/shared/BackLink";
import { DetailCard, DetailGrid, DetailHeader, ToneBadge, type BadgeTone } from "@/components/shared/DetailHeader"; // [2026-10-28]: diseño del tema de Recursos
import { RowActions } from "@/components/admin/RowActions";
import { ActivityPreview } from "@/components/activities/ActivityPreview";
import { MediaUpload } from "@/components/activities/MediaUpload";
import { toPortalRole } from "@/components/portal/portal-role";
import { getCurrentUserPayload } from "@/lib/auth";
import { ACTIVITY_TAB_KEYS, ACTIVITY_TABS, BLOCKER_LABEL, listActivities, STATUS_LABEL, withReturn, type ActivityTab } from "@/lib/activities-api";
import { ACTIVITY_KINDS, isCreatableKind } from "@/lib/activity-kinds";
import { languageLabel } from "@/lib/languages";
import { deleteActivityAction, setActivityPublishedAction } from "../../../actions";
// [Página /admin/activities/ver/[tab]/[id] · 2026-10-25]: tras crear una actividad se llega AQUÍ (como en Recursos) → vista previa tal como la verá el estudiante
// + estado (Borrador/Publicada) + Publicar · Editar · Eliminar. Todo se crea en borrador y solo se publica tras revisarlo
// [2026-10-27]: MISMA disposición que el detalle de un recurso (/admin/curriculum/[id]): «Volver», cabecera con estado, «Así lo verá el estudiante» + «Estado de publicación»
// La vista previa es de Next.js (ActivityPreview) — antes un <iframe> con la pantalla Angular completa (menú y cabecera propios: «otra aplicación»)
// Publicar/Eliminar con toast (RowActions) · tras eliminar → vuelve a la lista · docente en Música → «Enviar a revisión»
// [2026-10-28]: MISMO diseño que el tema de Recursos (/admin/curriculum/tema): DetailHeader con icono de la sección, datos + estado y acciones a la derecha; vista previa en DetailCard
// Eliminar confirma en Dialog (como Recursos), ya no en línea
// [Patrón]: Container (RSC) + Reuse (RowActions, listActivities, ActivityPreview) | [Principio]: DRY + mínimo privilegio (NestJS decide; la UI solo adapta los textos)

export const metadata: Metadata = { title: "Revisar actividad", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ActivityReviewPage(props: { params: Promise<{ tab: string; id: string }> }) {
  const { tab, id } = await props.params;
  if (!ACTIVITY_TAB_KEYS.includes(tab as ActivityTab)) notFound();
  const t = tab as ActivityTab;
  const def = ACTIVITY_TABS[t];
  const [rows, user] = await Promise.all([listActivities(t, "mine").catch(() => []), getCurrentUserPayload()]);
  const row = rows.find((r) => r.id === id);
  if (!row) notFound();
  const role = toPortalRole(user?.role ?? null);
  const published = row.status === "published";
  const listHref = `/admin/activities?tab=${t}`;
  // [Editar]: páginas de Next.js (Práctica, Diálogos, Lectura, Juegos) → sin «volver» a Angular; el resto conserva ?volver= para su editor
  const editHref = row.editHref ? (row.editHref.startsWith("/admin/") ? row.editHref : withReturn(row.editHref, t)) : undefined;
  const upload = isCreatableKind(t) ? ACTIVITY_KINDS[t].mediaUpload : undefined;
  const TabIcon = def.icon; // `LucideIcon`: componente → nombre en mayúscula para usarlo en JSX
  const statusLabel = STATUS_LABEL[row.status ?? "draft"] ?? row.status;
  const tone: BadgeTone = published ? "brand" : row.status === "rejected" ? "danger" : "warning"; // [Estado → tono]: Publicada (marca) · Rechazada (peligro) · Borrador/En revisión (aviso)
  const badge = def.publish && statusLabel ? <ToneBadge tone={tone}>{statusLabel}</ToneBadge> : null; // Secciones sin estado (p. ej. diálogos) → sin insignia

  return (
    <div className="w-full space-y-5 py-4">
      <BackLink href={listHref} memo="activities">Volver a {def.label.toLowerCase()}</BackLink>

      {/* [Cabecera · 2026-10-28]: DetailHeader (MISMA pieza que el tema de Recursos y el detalle de Exámenes) | datos: sección · idioma · nivel · estado | acciones a la derecha */}
      <DetailHeader
        icon={<TabIcon className="size-8" />}
        title={row.title}
        meta={
          <>
            {def.label} · {row.language ? languageLabel(row.language) : "—"} · {row.level ?? "—"}
            {badge && <> · {badge}</>}
          </>
        }
        actions={
          <RowActions
            hard={!editHref?.startsWith("/admin/")} // Editores de Angular → navegación completa
            title={row.title}
            tryHref={row.viewHref} // [2026-10-30]: Probar · Editar · Publicar · Eliminar (uniforme)
            editHref={editHref}
            publish={def.publish ? { isPublished: published, toggle: setActivityPublishedAction.bind(null, t, row.id, !published) } : undefined}
            publishLabel={role !== "admin" ? def.teacherPublishLabel : undefined}
            onDelete={def.remove ? deleteActivityAction.bind(null, t, row.id) : undefined}
            afterDeleteHref={listHref}
            deleteTitle={`Eliminar «${row.title}»${def.removeNote ? ` · ${def.removeNote}` : ""}`} // [2026-10-28]: confirmación en Dialog (como Recursos), ya no en línea
          />
        }
      >
        {row.description && <p className="mt-1 text-muted-foreground">{row.description}</p>}
      </DetailHeader>

      {/* [Estado de publicación]: qué falta para que lo vean los estudiantes (no solo el color de la insignia) | role="status" → lo anuncian los lectores de pantalla */}
      {def.publish && !published && (
        <p role="status" className="rounded-lg border border-tone-warning-line bg-tone-warning-soft px-4 py-3 text-tone-warning">
          {role !== "admin" && def.teacherPublishLabel
            ? "Borrador: revísala y envíala a revisión; un administrador la publicará."
            : "Borrador: los estudiantes aún no la ven. Revisa la vista previa y pulsa «Publicar» cuando esté lista."}
          {row.blockers?.length ? ` Para publicar falta: ${row.blockers.map((b) => BLOCKER_LABEL[b] ?? b).join(", ")}.` : null}
        </p>
      )}

      {/* [Tarjeta de vista previa]: MISMA tarjeta que los elementos de un tema (barra con título + estado, cuerpo, pie) | `col-span-full`: ocupa todo el ancho de la rejilla */}
      <DetailGrid label="Vista previa">
        <DetailCard className="col-span-full" lang={row.language ?? undefined} title="Así lo verá el estudiante" badge={badge} footer={upload ? <MediaUpload url={upload.path(row.id)} accept={upload.accept} label={upload.label} hint={upload.hint} /> : undefined}>
          <ActivityPreview tab={t} id={row.id} viewHref={row.viewHref} title={row.title} />
        </DetailCard>
      </DetailGrid>
    </div>
  );
}
