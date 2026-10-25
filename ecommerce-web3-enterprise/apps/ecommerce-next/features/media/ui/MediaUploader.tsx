// MediaUploader.tsx (Client Component) => zona de subida: arrastrar y soltar o elegir archivos (input nativo).
// Valida tipo, tamaño y cantidad ANTES de enviar (ahorro de red) y sube a Cloudinary vía Express (Sharp optimiza en el
// servidor). Reutilizable: el Media Manager (con etiquetas, marca de agua y videos: RF-26.1 / 26.5 / 26.7) y el
// formulario de producto (solo imágenes) lo usan con "onUploaded".
// Patrones: Strategy (origen del archivo: drop o selector, mismo flujo) + Observer (callback onUploaded).
// Accesibilidad: el <label> envuelve un <input type="file"> real => funciona con teclado y lector de pantalla;
// el arrastre es solo una mejora para ratón.
"use client";

import { useId, useState, type DragEvent } from "react";
import { useTranslations } from "next-intl";
import { useUploadMedia, type MediaAsset } from "../api/media.api";
import { MEDIA_ACCEPT, splitTags, validateFiles, VIDEO_ACCEPT, type MediaFolder } from "../lib/media.validator";
import { useErrorMessage } from "@/shared/hook/useErrorMessage";
import { toast } from "@/shared/ui/Toast";
import { Spinner } from "@/shared/ui/Spinner";
import { cn } from "@/shared/lib/cn";

interface MediaUploaderProps {
  folder: MediaFolder;
  onUploaded?: (assets: MediaAsset[]) => void; // Observer: quien lo usa decide qué hacer con lo subido
  library?: boolean; // true => Media Manager: acepta videos y muestra etiquetas + marca de agua
}

export function MediaUploader({ folder, onUploaded, library = false }: MediaUploaderProps) {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const upload = useUploadMedia();
  const [dragging, setDragging] = useState(false);
  const [tags, setTags] = useState("");
  const [watermark, setWatermark] = useState(false);
  const id = useId();
  const accept = library ? [...MEDIA_ACCEPT, ...VIDEO_ACCEPT] : MEDIA_ACCEPT;

  // send => valida, informa rechazos y sube los válidos (imágenes y videos en paralelo, un envío por tipo)
  const send = (list: FileList | null) => {
    const { valid, errors } = validateFiles(Array.from(list ?? []), library ? undefined : "image"); // "Array.from" => FileList -> Array
    errors.forEach((error) => toast.error(t(error.key, { name: error.name })));
    if (valid.length === 0) return;
    upload.mutate(
      { files: valid, folder, tags: splitTags(tags), watermark },
      {
        onSuccess: (assets) => {
          toast.success(t("admin.media.uploaded", { count: assets.length }));
          onUploaded?.(assets); // "?." => el callback es opcional
        },
        onError: (error) => toast.error(errorMessage(error)),
      }
    );
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault(); // Evita que el navegador abra la imagen en otra pestaña
    setDragging(false);
    send(event.dataTransfer.files);
  };

  return (
    <div className="flex flex-col gap-2">
      {library && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium">
            {t("admin.media.uploadTags")}
            <input value={tags} onChange={(event) => setTags(event.target.value)} maxLength={400} placeholder={t("admin.media.tagsHint")} className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
          {/* RF-26.5 la marca se aplica en la URL de entrega: el original queda intacto y se puede quitar después */}
          <label className="flex h-9 items-center gap-2 text-sm">
            <input type="checkbox" className="size-4" checked={watermark} onChange={(event) => setWatermark(event.target.checked)} />
            {t("admin.media.watermark")}
          </label>
        </div>
      )}
      <label
        htmlFor={id}
        onDragOver={(event) => (event.preventDefault(), setDragging(true))}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-sm focus-within:ring-2 focus-within:ring-ring",
          dragging ? "border-primary bg-primary/5" : "border-input hover:bg-accent"
        )}
      >
        {upload.isPending ? <Spinner /> : <span aria-hidden="true" className="text-2xl">⬆️</span>}
        <span className="font-medium">{upload.isPending ? t("admin.media.uploading") : t(library ? "admin.media.dropAny" : "admin.media.drop")}</span>
        <span className="text-xs text-slate-500">{t(library ? "admin.media.limitsAny" : "admin.media.limits")}</span>
        {/* sr-only => invisible pero enfocable y anunciado; "multiple" => varios archivos por envío */}
        <input id={id} type="file" multiple accept={accept.join(",")} className="sr-only" disabled={upload.isPending} onChange={(event) => (send(event.target.files), (event.target.value = ""))} />
      </label>
    </div>
  );
}
