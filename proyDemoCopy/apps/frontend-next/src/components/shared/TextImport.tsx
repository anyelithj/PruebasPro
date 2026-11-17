"use client"; // [Next.js]: Client Component → selector de archivo, estado de carga y fetch al BFF
import { FileText, FileUp, Link2, Loader2, X } from "lucide-react"; // [lucide-react]: iconos SVG uniformes del portal | [2026-10-28]: + FileText/X (adjunto y «Quitar»)
import { useEffect, useId, useRef, useState } from "react";
import { youtubeEmbed } from "@/lib/youtube"; // [React]: useId → ids accesibles únicos · useState → estado local
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
  endpoint?: string; // [2026-10-24]: Route Handler que extrae (por defecto /api/media/extract-text; Cursos usa /api/courses/import con tope mayor) | [Principio]: OCP
  // [2026-10-28]: `onClear` opcional → al pulsar «Quitar» el formulario deshace lo que añadió (subtemas, texto) | sin él solo se limpia el importador | [Principio]: OCP
  onClear?: (result: ImportedText) => void;
  hint?: string | null; // [2026-10-28]: texto de ayuda bajo el título (null = sin texto → versión compacta dentro de un subtema)
}

// [Adjunto actual · 2026-10-28]: qué se importó (nombre del archivo o enlace) y su resultado → se muestra como «chip» con botón «Quitar»
interface Attached {
  name: string;
  kind: "file" | "url";
  result: ImportedText;
}

const DEFAULT_HINT = "PDF, Word, Excel, texto, imagen (OCR), audio o video (transcripción) · máx. 25 MB · o pega un enlace.";

export function TextImport({ language = "en", onText, label = "Importar contenido", endpoint = "/api/media/extract-text", onClear, hint = DEFAULT_HINT }: TextImportProps) {
  const id = useId(); // `useId` (React 18+): ids estables entre servidor y cliente
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null); // Mensaje de progreso o null
  const [error, setError] = useState<string | null>(null);
  const [attached, setAttached] = useState<Attached | null>(null); // [2026-10-28]: último archivo/enlace importado (null = nada adjunto)
  // `useRef` (React): AbortController de la lectura en curso → «Cancelar» corta el fetch sin re-render | [Web API]: AbortController
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null); // Para devolver el foco al botón tras «Quitar» (a11y)
  // `useEffect` con limpieza (React): al desmontar (p. ej. se cierra el importador de un subtema) se cancela la lectura → no llega un onText «huérfano»
  useEffect(() => () => abortRef.current?.abort(), []);
  // [Latest callback · 2026-10-28]: la lectura puede tardar minutos (OCR, transcripción) → al terminar se llama al onText/onClear MÁS RECIENTE
  // (no al de cuando se pulsó) y así no se pisan los cambios hechos mientras tanto | [Patrón]: Latest Ref | `useEffect` sin deps: tras cada render
  const callbacks = useRef({ onText, onClear });
  useEffect(() => {
    callbacks.current = { onText, onClear };
  });

  // [run]: una sola ruta para archivo (multipart) o enlace (JSON) | [Patrón]: Template Method funcional
  const run = async (body: BodyInit, json: boolean, what: string, source: Omit<Attached, "result">) => {
    abortRef.current?.abort(); // Una sola lectura a la vez
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setError(null);
    setBusy(what);
    try {
      const res = await fetch(endpoint, { method: "POST", body, headers: json ? { "Content-Type": "application/json" } : undefined, signal: ctrl.signal });
      const data = (await res.json().catch(() => ({}))) as Partial<ImportedText> & { message?: string };
      // [Fix 2026-10-28]: 401 → mensaje claro (la sesión caducó) en vez de «Unauthorized»
      if (res.status === 401) throw new Error(data.message ?? "Tu sesión expiró: vuelve a iniciar sesión.");
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      done({ title: data.title ?? "", text: data.text ?? "", markdown: data.markdown ?? data.text ?? "", holder: data.holder ?? "" }, source);
    } catch (err) {
      // `AbortError`: lo canceló el usuario → sin mensaje de error
      if ((err as Error)?.name !== "AbortError") setError(err instanceof Error ? err.message : "No se pudo leer el contenido.");
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      setBusy(null);
    }
  };

  // [done]: entrega el resultado al formulario y lo deja como adjunto visible (se puede quitar)
  const done = (result: ImportedText, source: Omit<Attached, "result">) => {
    setAttached({ ...source, result });
    setUrl("");
    callbacks.current.onText(result);
  };

  // [clear · 2026-10-28]: «Quitar» el adjunto → cancela una lectura en curso, limpia estado y avisa al formulario (onClear) | foco de vuelta al botón «Subir archivo» (a11y)
  const clear = () => {
    abortRef.current?.abort();
    if (attached) callbacks.current.onClear?.(attached.result);
    setAttached(null);
    setError(null);
    setUrl("");
    if (fileRef.current) fileRef.current.value = "";
    fileRef.current?.focus();
  };

  // [fromUrl · 2026-10-25]: un video de YouTube no se «lee»: entra como enlace y el Markdown lo muestra incrustado
  const fromUrl = () => {
    const link = url.trim();
    if (youtubeEmbed(link)) return done({ title: "Video", text: link, markdown: link, holder: "" }, { name: link, kind: "url" });
    void run(JSON.stringify({ url: link, language }), true, "Leyendo el enlace…", { name: link, kind: "url" });
  };

  const fromFile = (file: File | undefined) => {
    if (!file) return;
    const form = new FormData(); // [Web API]: multipart con el archivo y el idioma
    form.append("file", file);
    form.append("language", language);
    // `test` (RegExp): audio/video tardan más (Whisper en CPU) → aviso honesto
    void run(form, false, /^(audio|video)\//.test(file.type) ? `Transcribiendo «${file.name}» (puede tardar unos minutos)…` : `Leyendo «${file.name}»…`, { name: file.name, kind: "file" });
  };

  return (
    // [Semántica]: <fieldset> + <legend> agrupa los dos modos de importación | [a11y]
    <fieldset className="space-y-2 rounded-xl border border-dashed border-tone-brand-line bg-tone-brand-soft p-4" aria-busy={Boolean(busy)}>
      <legend className="px-1 text-sm font-semibold">{label}</legend>
      {hint && <p className="type-meta text-muted-foreground">{hint}</p>}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* [Archivo]: el <input> va oculto dentro del <label> con estilo de botón → todo el botón abre el diálogo */}
        <label className="btn btn-outline btn-sm cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
          <FileUp aria-hidden className="size-4" /> Subir archivo
          <input ref={fileRef} type="file" accept={TEXT_IMPORT_ACCEPT} className="sr-only" disabled={Boolean(busy)} onChange={(e) => { fromFile(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {/* [Enlace]: <form> propio anidado no es válido en HTML → div + botón type=button */}
        <div className="flex flex-1 gap-2">
          <label htmlFor={`${id}-url`} className="sr-only">Enlace</label>
          <input id={`${id}-url`} type="url" inputMode="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (url.trim()) fromUrl(); } }} className="control min-w-0 flex-1" />
          <button type="button" className="btn btn-outline btn-sm" disabled={Boolean(busy) || !URL.canParse(url.trim())} onClick={() => fromUrl()}>
            <Link2 aria-hidden className="size-4" /> Importar
          </button>
        </div>
      </div>
      {busy && (
        <div className="flex flex-wrap items-center gap-2">
          <p role="status" aria-live="polite" className="flex items-center gap-2 type-meta font-semibold text-tone-brand">
            <Loader2 aria-hidden className="size-4 animate-spin" /> {busy}
          </p>
          {/* [2026-10-28]: cancelar una lectura larga (OCR, transcripción) */}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => abortRef.current?.abort()}>
            <X aria-hidden className="size-4" /> Cancelar
          </button>
        </div>
      )}
      {/* [Adjunto · 2026-10-28]: chip con el archivo/enlace importado + «Quitar» (deshace lo añadido si el formulario pasa onClear) | `truncate` + `min-w-0`: nombres largos sin desbordar en móvil */}
      {attached && !busy && (
        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm">
          {attached.kind === "file" ? <FileText aria-hidden className="size-4 shrink-0 text-tone-brand" /> : <Link2 aria-hidden className="size-4 shrink-0 text-tone-brand" />}
          <span className="min-w-0 flex-1 truncate" title={attached.name}>
            <span className="sr-only">{attached.kind === "file" ? "Archivo importado: " : "Enlace importado: "}</span>
            {attached.name}
          </span>
          <button type="button" className="btn btn-ghost btn-sm px-2! text-tone-danger" onClick={clear} aria-label={`Quitar «${attached.name}»${onClear ? " y lo que se importó de él" : ""}`}>
            <X aria-hidden className="size-4" /> <span className="hidden sm:inline">Quitar</span>
          </button>
        </div>
      )}
      {error && <p role="alert" className="type-meta text-tone-danger">{error}</p>}
    </fieldset>
  );
}
