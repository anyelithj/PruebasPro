"use client"; // [Next.js]: Client Component → selector de archivo, estado de carga y fetch al BFF
import { FileUp, Link2, Loader2 } from "lucide-react"; // [lucide-react]: iconos SVG uniformes del portal
import { useId, useState } from "react"; // [React]: useId → ids accesibles únicos · useState → estado local
// [TextImport · 2026-10-23]: «Importar contenido» desde un ARCHIVO (PDF, Word, Excel, texto, imagen con OCR, audio/video con transcripción) o un ENLACE → texto + Markdown | espejo Next de la molécula Angular `aula-text-import`
// [Patrón]: Presentational + Adapter (BFF /api/media/extract-text) + Callback (onText) | [Principio]: SRP + DRY (cursos, actividades y cualquier formulario que lo necesite) | [Paradigma]: Declarativo + asíncrono

// `export interface` (TS): forma devuelta por /api/media/extract-text | [Principio]: SSOT con lib/extract-text.ts
export interface ImportedText {
  title: string;
  text: string;
  markdown: string;
  holder: string;
}

// [Formatos]: extensiones (Windows arma el filtro del diálogo con ellas) | [Principio]: SSOT del selector
export const TEXT_IMPORT_ACCEPT = ".pdf,.docx,.xlsx,.xls,.ods,.csv,.txt,.md,.srt,.lrc,.png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.m4a,.ogg,.mp4,.webm,.mov";

interface TextImportProps {
  language?: string; // Idioma del contenido → OCR y transcripción más precisos
  onText: (result: ImportedText) => void; // [Callback]: el formulario decide qué campo rellenar
  label?: string; // Título del bloque
}

export function TextImport({ language = "en", onText, label = "Importar contenido" }: TextImportProps) {
  const id = useId(); // `useId` (React 18+): ids estables entre servidor y cliente
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null); // Mensaje de progreso o null
  const [error, setError] = useState<string | null>(null);

  // [run]: una sola ruta para archivo (multipart) o enlace (JSON) | [Patrón]: Template Method funcional
  const run = async (body: BodyInit, json: boolean, what: string) => {
    setError(null);
    setBusy(what);
    try {
      const res = await fetch("/api/media/extract-text", { method: "POST", body, headers: json ? { "Content-Type": "application/json" } : undefined });
      const data = (await res.json().catch(() => ({}))) as Partial<ImportedText> & { message?: string };
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      onText({ title: data.title ?? "", text: data.text ?? "", markdown: data.markdown ?? data.text ?? "", holder: data.holder ?? "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer el contenido.");
    } finally {
      setBusy(null);
    }
  };

  const fromFile = (file: File | undefined) => {
    if (!file) return;
    const form = new FormData(); // [Web API]: multipart con el archivo y el idioma
    form.append("file", file);
    form.append("language", language);
    // `test` (RegExp): audio/video tardan más (Whisper en CPU) → aviso honesto
    void run(form, false, /^(audio|video)\//.test(file.type) ? `Transcribiendo «${file.name}» (puede tardar unos minutos)…` : `Leyendo «${file.name}»…`);
  };

  return (
    // [Semántica]: <fieldset> + <legend> agrupa los dos modos de importación | [a11y]
    <fieldset className="space-y-2 rounded-xl border border-dashed border-tone-brand-line bg-tone-brand-soft p-4" aria-busy={Boolean(busy)}>
      <legend className="px-1 text-sm font-semibold">{label}</legend>
      <p className="text-xs text-muted-foreground">PDF, Word, Excel, texto, imagen (OCR), audio o video (transcripción) · máx. 25 MB · o pega un enlace.</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* [Archivo]: el <input> va oculto dentro del <label> con estilo de botón → todo el botón abre el diálogo */}
        <label className="btn btn-outline btn-sm cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
          <FileUp aria-hidden className="size-4" /> Subir archivo
          <input type="file" accept={TEXT_IMPORT_ACCEPT} className="sr-only" disabled={Boolean(busy)} onChange={(e) => { fromFile(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {/* [Enlace]: <form> propio anidado no es válido en HTML → div + botón type=button */}
        <div className="flex flex-1 gap-2">
          <label htmlFor={`${id}-url`} className="sr-only">Enlace</label>
          <input id={`${id}-url`} type="url" inputMode="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (url.trim()) void run(JSON.stringify({ url: url.trim(), language }), true, "Leyendo el enlace…"); } }} className="control min-w-0 flex-1" />
          <button type="button" className="btn btn-outline btn-sm" disabled={Boolean(busy) || !URL.canParse(url.trim())} onClick={() => void run(JSON.stringify({ url: url.trim(), language }), true, "Leyendo el enlace…")}>
            <Link2 aria-hidden className="size-4" /> Importar
          </button>
        </div>
      </div>
      {busy && (
        <p role="status" aria-live="polite" className="flex items-center gap-2 text-xs font-semibold text-tone-brand">
          <Loader2 aria-hidden className="size-4 animate-spin" /> {busy}
        </p>
      )}
      {error && <p role="alert" className="text-xs text-tone-danger">{error}</p>}
    </fieldset>
  );
}
