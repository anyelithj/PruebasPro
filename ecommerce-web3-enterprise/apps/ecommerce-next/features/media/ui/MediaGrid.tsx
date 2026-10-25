// MediaGrid.tsx (Client Component) => Media Manager (biblioteca centralizada): búsqueda por texto, etiqueta, tipo y
// carpeta (RF-26.1), zona de subida con etiquetas / marca de agua / videos, grilla con selección múltiple y borrado en
// lote (RF-26.3), estado del respaldo + "Respaldar ahora" (RF-26.4), "Cargar más" por cursor y diálogo de detalle.
// Patrones: Composite (grilla de tarjetas) + Observer (Redux: filtros/selección; TanStack Query: archivos).
// Ahorro/rendimiento: miniaturas de 160 px con next/image (lazy por defecto, AVIF/WebP), videos con su PORTADA (el
// video solo se descarga al abrir el detalle), búsqueda al enviar (sin una petición por tecla), 30 por página.
// Accesibilidad: cada tarjeta es un checkbox real (selección) + un botón (detalle); estado anunciado con aria-live.
"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useBackupStats, useDeleteMedia, useMediaList, useMediaTags, useRunBackup, type MediaAsset } from "../api/media.api";
import { useMediaLibrary } from "../model/media.store";
import { MEDIA_FOLDERS, type MediaFolder, type MediaKind } from "../lib/media.validator";
import { MediaUploader } from "./MediaUploader";
import { MediaPreview } from "./MediaPreview";
import { useErrorMessage } from "@/shared/hook/useErrorMessage";
import { useFormat } from "@/shared/hook/useFormat";
import { Button } from "@/shared/ui/Button";
import { Skeleton } from "@/shared/ui/Skeleton";
import { toast } from "@/shared/ui/Toast";
import { cn } from "@/shared/lib/cn";

const FIELD = "h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`; // Peso legible (función pura)

// BackupBar => RF-26.4 resumen del respaldo (archivos, espacio, última copia) y respaldo incremental bajo demanda
function BackupBar() {
  const t = useTranslations("admin.media");
  const format = useFormat();
  const errorMessage = useErrorMessage();
  const stats = useBackupStats();
  const run = useRunBackup();
  return (
    <section aria-label={t("backupTitle")} className="flex flex-col gap-2 rounded-lg border bg-slate-50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p aria-live="polite">
        <span className="font-medium">{t("backupTitle")}: </span>
        {stats.data ? t("backupStats", { files: stats.data.files, size: mb(stats.data.bytes), last: stats.data.lastBackupAt ? format.dateTime(stats.data.lastBackupAt) : "—" }) : "…"}
      </p>
      <Button size="sm" variant="secondary" loading={run.isPending} onClick={() => run.mutate(undefined, { onSuccess: (result) => toast.success(t("backupDone", { copied: result.copied, skipped: result.skipped })), onError: (error) => toast.error(errorMessage(error)) })}>
        {t("backupNow")}
      </Button>
    </section>
  );
}

export function MediaGrid() {
  const t = useTranslations("admin.media");
  const errorMessage = useErrorMessage();
  const { filters, selected, setFilters, toggleSelected, clearSelected } = useMediaLibrary();
  const list = useMediaList(filters);
  const tags = useMediaTags(filters.type === "video" ? "video" : "image");
  const remove = useDeleteMedia();
  const [open, setOpen] = useState<MediaAsset | null>(null); // Detalle abierto: estado local (useState)
  // "flatMap" => aplana las páginas del cursor en una sola lista
  const assets = list.data?.pages.flatMap((page) => page.items) ?? [];

  const onBulkDelete = () => {
    if (!window.confirm(t("confirmBulk", { count: selected.length }))) return;
    remove.mutate(selected, { onSuccess: () => (toast.success(t("deleted")), clearSelected()), onError: (error) => toast.error(errorMessage(error)) });
  };
  // onSearch => el texto se aplica al enviar (Enter o botón): una petición por búsqueda, no por tecla
  const onSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters({ q: String(new FormData(event.currentTarget).get("q") ?? "").trim() });
  };

  return (
    <div className="flex flex-col gap-4">
      <BackupBar />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
          <form role="search" onSubmit={onSearch} className="flex items-end gap-2 sm:col-span-2">
            <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium">
              {t("search")}
              <input name="q" type="search" defaultValue={filters.q} maxLength={80} placeholder={t("searchHint")} className={FIELD} />
            </label>
            <Button type="submit" size="sm" variant="secondary">{t("searchSubmit")}</Button>
          </form>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("folder")}
            <select value={filters.folder} onChange={(event) => setFilters({ folder: event.target.value as MediaFolder | "" })} className={FIELD}>
              <option value="">{t("allFolders")}</option>
              {MEDIA_FOLDERS.map((value) => <option key={value} value={value}>{t(`folders.${value}`)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("type")}
            <select value={filters.type} onChange={(event) => setFilters({ type: event.target.value as MediaKind | "", tag: "" })} className={FIELD}>
              <option value="">{t("allTypes")}</option>
              <option value="image">{t("types.image")}</option>
              <option value="video">{t("types.video")}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("tag")}
            <select value={filters.tag} onChange={(event) => setFilters({ tag: event.target.value })} className={FIELD}>
              <option value="">{t("allTags")}</option>
              {(tags.data ?? []).filter((tag) => tag !== "watermark").map((tag) => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          </label>
        </div>
        {selected.length > 0 && (
          <div className="flex items-center gap-2">
            <span aria-live="polite" className="text-sm text-slate-600">{t("selected", { count: selected.length })}</span>
            <Button size="sm" variant="ghost" onClick={() => clearSelected()}>{t("clear")}</Button>
            <Button size="sm" variant="danger" loading={remove.isPending} onClick={onBulkDelete}>{t("deleteSelected")}</Button>
          </div>
        )}
      </div>

      {/* Sin carpeta elegida se sube a "products" (los videos van a "videos") */}
      <MediaUploader folder={filters.folder || "products"} library />

      {list.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : assets.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">{t("empty")}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6" aria-busy={list.isFetching || undefined}>
          {assets.map((asset) => {
            const checked = selected.includes(asset.publicId);
            const name = asset.title || asset.alt || asset.publicId.split("/").pop() || asset.publicId; // Nombre legible
            const video = asset.resourceType === "video";
            return (
              <li key={asset.publicId} className={cn("relative overflow-hidden rounded-lg border", checked && "ring-2 ring-primary")}>
                <button type="button" onClick={() => setOpen(asset)} className="block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Image src={video ? (asset.posterUrl ?? asset.url) : asset.url} alt={asset.alt ?? ""} width={160} height={160} sizes="160px" className="aspect-square w-full bg-muted object-cover" />
                  <span className="block truncate px-2 pt-1 text-left text-xs">{name}</span>
                  {asset.tags && asset.tags.length > 0 && <span className="block truncate px-2 pb-1 text-left text-[11px] text-slate-500">#{asset.tags.join(" #")}</span>}
                </button>
                {video && <span className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-white">▶ {t("types.video")}</span>}
                {asset.watermark && <span className="absolute bottom-12 right-1 rounded bg-background/90 px-1.5 py-0.5 text-[11px]">{t("watermarkBadge")}</span>}
                <label className="absolute left-1 top-1 flex size-8 items-center justify-center rounded bg-background/90">
                  <span className="sr-only">{t("select", { name })}</span>
                  <input type="checkbox" className="size-4" checked={checked} onChange={() => toggleSelected(asset.publicId)} />
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {list.hasNextPage && (
        <Button variant="secondary" className="self-center" loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
          {t("loadMore")}
        </Button>
      )}

      <MediaPreview asset={open} onClose={() => setOpen(null)} />
    </div>
  );
}
