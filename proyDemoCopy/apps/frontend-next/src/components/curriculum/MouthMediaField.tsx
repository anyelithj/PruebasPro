"use client"; // [Next.js]: Client Component → elegir archivo, subirlo y mostrar la vista previa
import { useId, useState } from "react";
import { Link2, Trash2, Upload } from "lucide-react";
import { MouthMedia } from "@/components/curriculum/MouthMedia";
// [MouthMediaField · 2026-11-14]: subir una imagen o un video de la BOCA para «Cómo se pronuncia» (editor de fichas de pronunciación)
// POST multipart a /api/pronunciation-media (BFF → NestJS) → guarda la clave en el contenido (`mouthMedia`) al guardar la ficha
// [Patrón]: Controlled Component (el editor guarda la clave) + Command (subida) | [Principio]: SRP + DRY (MouthMedia para la vista previa)
// [A11y]: <label> que envuelve el input (teclado) · resultado en aria-live · botón «Quitar» con nombre

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"; // = lista blanca de NestJS
const MAX_MB = 30; // = MAX_PRONUNCIATION_MEDIA_BYTES de NestJS (se comprueba antes de subir)

export function MouthMediaField({ value, onChange }: { value?: string; onChange: (key: string) => void }) {
  const inputId = useId();
  const urlId = useId();
  const [urlDraft, setUrlDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) return setError(`El archivo supera ${MAX_MB} MB.`);
    setBusy(true);
    setError("");
    const form = new FormData(); // `FormData` (Web API): multipart con el archivo
    form.append("file", file);
    try {
      const res = await fetch("/api/pronunciation-media", { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as { data?: { key?: string }; key?: string; message?: string };
      const key = body.data?.key ?? body.key; // NestJS envuelve en { data } (interceptor de respuesta)
      if (!res.ok || !key) throw new Error(body.message ?? `HTTP ${res.status}`);
      onChange(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir el archivo.");
    } finally {
      setBusy(false);
    }
  };

  // [URL · 2026-11-14]: enlace https a una imagen, un .mp4/.webm o un video de YouTube (alternativa a subir el archivo)
  const onUrl = (raw: string) => {
    const url = raw.trim();
    if (!url) return;
    if (!/^https:\/\/[^\s"'<>]+$/.test(url)) return setError("Escribe un enlace que empiece por https://");
    setError("");
    setUrlDraft("");
    onChange(url);
  };

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border p-3 sm:col-span-2">
      <p className="text-xs font-semibold text-muted-foreground">Imagen o video de la boca (opcional)</p>
      {value && <MouthMedia mediaKey={value} />}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={urlId} className="sr-only">
          Enlace de la imagen o del video de YouTube
        </label>
        <input
          id={urlId}
          type="url"
          inputMode="url"
          placeholder="https://… (imagen o YouTube)"
          value={urlDraft}
          onChange={(e) => setUrlDraft(e.target.value)}
          onBlur={() => onUrl(urlDraft)} // [Fix 2026-11-16]: pegar el enlace y pulsar «Guardar» sin «Usar enlace» ya no lo pierde
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault(); // No envía el formulario de la ficha
              onUrl(urlDraft);
            }
          }}
          className="control min-w-0 flex-1 basis-56"
        />
        <button type="button" className="btn btn-outline btn-sm" disabled={!urlDraft.trim()} onClick={() => onUrl(urlDraft)}>
          <Link2 aria-hidden className="size-4" /> Usar enlace
        </button>
        <span className="text-xs text-muted-foreground">o</span>
        <label htmlFor={inputId} className={`btn btn-outline btn-sm w-fit cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${busy ? "pointer-events-none opacity-50" : ""}`}>
          <Upload aria-hidden className="size-4" /> {busy ? "Subiendo…" : value ? "Cambiar archivo" : "Subir imagen o video"}
          <input id={inputId} type="file" accept={ACCEPT} className="sr-only" disabled={busy} onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>
        {value && (
          <button type="button" className="btn btn-ghost btn-sm text-tone-danger" onClick={() => onChange("")}>
            <Trash2 aria-hidden className="size-4" /> Quitar
          </button>
        )}
      </div>
      <p className="type-meta text-muted-foreground">Enlace https (imagen, MP4/WEBM o YouTube) o archivo PNG, JPEG, WEBP, GIF, MP4 o WEBM · máx. {MAX_MB} MB. Muestra labios, lengua y mandíbula de frente o de perfil.</p>
      <p aria-live="polite" className={error ? "text-xs text-tone-danger" : "sr-only"}>
        {error}
      </p>
    </div>
  );
}
