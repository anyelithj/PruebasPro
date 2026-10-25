// MediaPreview.tsx (Client Component) => detalle de un archivo en un diálogo: vista previa (imagen o video), datos
// técnicos, metadatos y etiquetas (RF-26.1 / 26.7), marca de agua opcional (RF-26.5), dónde se usa y respaldos con
// restauración (RF-26.4), copiar URL, reemplazar el archivo (mismo publicId: lo que lo usa no se rompe) y borrar.
// Patrones: Factory (vista según haya o no asset abierto) + Command (acciones sobre el asset).
// Accesibilidad: <video controls> nativo con "preload=none" (no descarga hasta reproducir), listas con encabezados.
"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useDeleteMedia, useMediaBackups, useMediaUsage, useRestoreBackup, useUpdateMedia, useUpdateMeta, type MediaAsset } from "../api/media.api";
import { MEDIA_ACCEPT, metaSchema, splitTags, validateFiles, type MetaValues } from "../lib/media.validator";
import { useZodForm } from "@/shared/hook/useZodForm";
import { useErrorMessage } from "@/shared/hook/useErrorMessage";
import { useFormat } from "@/shared/hook/useFormat";
import { Modal } from "@/shared/ui/Modal";
import { Input } from "@/shared/ui/Input";
import { Button } from "@/shared/ui/Button";
import { toast } from "@/shared/ui/Toast";

export function MediaPreview({ asset, onClose }: { asset: MediaAsset | null; onClose: () => void }) {
  const t = useTranslations("admin.media");
  return (
    <Modal open={asset !== null} onClose={onClose} title={t("detail")}>
      {/* "key" => al abrir otro archivo se reinicia el formulario (nuevo estado Formik) */}
      {asset && <PreviewBody key={asset.publicId} asset={asset} onClose={onClose} />}
    </Modal>
  );
}

// UsageAndBackups => RF-26.4 referencias del archivo en el sistema y versiones respaldadas (restaurar = mismo publicId)
function UsageAndBackups({ publicId }: { publicId: string }) {
  const t = useTranslations("admin.media");
  const format = useFormat();
  const errorMessage = useErrorMessage();
  const usage = useMediaUsage(publicId);
  const backups = useMediaBackups(publicId);
  const restore = useRestoreBackup();
  return (
    <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
      <section aria-labelledby="media-usage">
        <h3 id="media-usage" className="mb-1 text-sm font-semibold">{t("usage")}</h3>
        {usage.isLoading ? <p>…</p> : (usage.data ?? []).length === 0 ? <p className="text-slate-500">{t("unused")}</p> : (
          <ul className="flex max-h-32 flex-col gap-0.5 overflow-y-auto">
            {usage.data?.map((item) => <li key={`${item.type}-${item.id}`}><span className="font-medium">{t(`usageTypes.${item.type}`)}</span> · {item.label}</li>)}
          </ul>
        )}
      </section>
      <section aria-labelledby="media-backups">
        <h3 id="media-backups" className="mb-1 text-sm font-semibold">{t("backups")}</h3>
        {(backups.data ?? []).length === 0 ? <p className="text-slate-500">{t("noBackups")}</p> : (
          <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto">
            {backups.data?.map((backup) => (
              <li key={backup.id} className="flex items-center justify-between gap-2">
                <time dateTime={backup.createdAt}>{format.dateTime(backup.createdAt)}</time>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={restore.isPending && restore.variables === backup.id}
                  onClick={() => window.confirm(t("confirmRestore")) && restore.mutate(backup.id, { onSuccess: () => toast.success(t("restored")), onError: (error) => toast.error(errorMessage(error)) })}
                >
                  {t("restore")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PreviewBody({ asset, onClose }: { asset: MediaAsset; onClose: () => void }) {
  const t = useTranslations("admin.media");
  const tRoot = useTranslations();
  const errorMessage = useErrorMessage();
  const update = useUpdateMedia();
  const meta = useUpdateMeta();
  const remove = useDeleteMedia();
  const notifyError = (error: unknown) => toast.error(errorMessage(error));
  const video = asset.resourceType === "video";
  const form = useZodForm({
    schema: metaSchema,
    initialValues: { alt: asset.alt ?? "", title: asset.title ?? "", description: asset.description ?? "", tags: (asset.tags ?? []).join(", "), watermark: asset.watermark ?? false } satisfies MetaValues,
    onSubmit: (values) =>
      meta
        .mutateAsync({ publicId: asset.publicId, type: video ? "video" : "image", alt: values.alt, title: values.title, description: values.description, tags: splitTags(values.tags), watermark: values.watermark })
        .then(() => toast.success(t("saved")), notifyError),
  });

  // replace => valida la imagen y la sube sobre el mismo publicId
  const replace = (list: FileList | null) => {
    const { valid, errors } = validateFiles(Array.from(list ?? []).slice(0, 1), "image");
    errors.forEach((error) => toast.error(tRoot(error.key, { name: error.name })));
    if (valid[0]) update.mutate({ publicId: asset.publicId, file: valid[0] }, { onSuccess: () => toast.success(t("replaced")), onError: notifyError });
  };

  const onDelete = () => {
    if (!window.confirm(t("confirmDelete"))) return;
    remove.mutate([asset.publicId], { onSuccess: () => (toast.success(t("deleted")), onClose()), onError: notifyError });
  };

  return (
    <div className="flex flex-col gap-4">
      {video ? (
        // RF-26.7 video transformado por Cloudinary (MP4/WebM según el navegador); portada como "poster"
        <video controls preload="none" poster={asset.posterUrl} src={asset.url} className="max-h-80 w-full rounded-md bg-black">
          <track kind="captions" />
        </video>
      ) : (
        // next/image con dimensiones reales => sin saltos de diseño (CLS); "sizes" pide la variante justa
        <Image src={asset.url} alt={asset.alt ?? ""} width={asset.width} height={asset.height} sizes="(max-width: 640px) 100vw, 480px" className="h-auto max-h-80 w-full rounded-md bg-muted object-contain" />
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-slate-600">
        <dt className="font-medium">ID</dt>
        <dd className="break-all">{asset.publicId}</dd>
        <dt className="font-medium">{t("size")}</dt>
        <dd>{`${asset.width} × ${asset.height}`}{asset.format ? ` · ${asset.format.toUpperCase()}` : ""}{asset.bytes ? ` · ${(asset.bytes / 1024).toFixed(0)} KB` : ""}{asset.duration ? ` · ${asset.duration} s` : ""}</dd>
      </dl>
      <form noValidate onSubmit={form.handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label={t("alt")} hint={t("altHint")} error={form.error("alt")} {...form.getFieldProps("alt")} />
        <Input label={t("title")} error={form.error("title")} {...form.getFieldProps("title")} />
        <Input label={t("description")} error={form.error("description")} className="sm:col-span-2" {...form.getFieldProps("description")} />
        <Input label={t("tags")} hint={t("tagsHint")} error={form.error("tags")} {...form.getFieldProps("tags")} />
        {!video && (
          <label className="flex items-center gap-2 self-center text-sm">
            <input type="checkbox" className="size-4" {...form.getFieldProps({ name: "watermark", type: "checkbox" })} />
            {t("watermark")}
          </label>
        )}
        <Button type="submit" loading={meta.isPending} className="sm:col-span-2 sm:justify-self-end">{t("saveMeta")}</Button>
      </form>
      <UsageAndBackups publicId={asset.publicId} />
      <div className="flex flex-wrap gap-2">
        {/* Clipboard API nativa: copia la URL optimizada para pegarla en contenidos */}
        <Button size="sm" variant="secondary" onClick={() => void navigator.clipboard.writeText(asset.url).then(() => toast.info(t("copied")))}>
          {t("copyUrl")}
        </Button>
        {!video && (
          <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-input px-3 text-sm hover:bg-accent focus-within:ring-2 focus-within:ring-ring">
            {t("replace")}
            <input type="file" accept={MEDIA_ACCEPT.join(",")} className="sr-only" onChange={(event) => replace(event.target.files)} />
          </label>
        )}
        <Button size="sm" variant="danger" loading={remove.isPending} onClick={onDelete}>
          {t("delete")}
        </Button>
      </div>
    </div>
  );
}
