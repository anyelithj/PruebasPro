"use client"; // [Next.js]: Client Component → lee archivos locales (File API) y muestra el progreso
import { useId, useState } from "react";
import { FileText, Link2 } from "lucide-react"; // [lucide-react]: iconos SVG uniformes
import { extract } from "@/components/curriculum/ImportPanel"; // [DRY]: MISMOS extractores que Recursos (SheetJS, mammoth, pdf.js, Tesseract)
import type { Extracted, Row } from "@/lib/resource-import";
import type { ImportSource } from "@/lib/activity-kinds";
// [SourceImport · 2026-10-24]: origen ÚNICO de «Importar» en Crear actividad — archivo (Excel, CSV, Word, PDF, texto, imagen con OCR, audio/video) o enlace
// Todo termina en el mismo `Extracted { rows, text }` del pipeline de Recursos → la estrategia del tipo decide cómo mapearlo (lib/activity-kinds)
// [Patrón]: Strategy (extractor por formato) + Chain of Responsibility (enlace: página/archivo → si no, transcripción/servidor) | [Principio]: DRY + SRP + OCP
// [Rutas reutilizadas]: /api/curriculum/import-url (página → tabla + texto; archivo → base64) y /api/media/extract-text (audio/video con Whisper, PowerPoint, OpenDocument, RTF…)

const MAX_DOC_MB = 15; // = ImportPanel (documentos se procesan en el navegador)
const MAX_MEDIA_MB = 25; // = MAX_MEDIA_BYTES de lib/extract-text (Whisper en NestJS/FastAPI)
// `accept`: documentos + imágenes + audio/video (el navegador filtra el selector de archivos)
const ACCEPT = ".xlsx,.xlsm,.xls,.csv,.tsv,.ods,.docx,.pdf,.txt,.pptx,.odt,.odp,.rtf,.epub,.md,.srt,.lrc,image/*,audio/*,video/*";
// [Solo servidor]: formatos que el navegador no extrae (transcripción y documentos ZIP/XML) → /api/media/extract-text
const MEDIA_EXT = new Set(["mp3", "wav", "m4a", "ogg", "oga", "opus", "mp4", "m4v", "webm", "mov"]); // `Set` (ES2015): búsqueda O(1)
const SERVER_EXT = new Set(["pptx", "odt", "odp", "rtf", "epub", "md", "srt", "lrc", ...MEDIA_EXT]);
const extOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";
const isMedia = (f: File) => /^(audio|video)\//.test(f.type) || MEDIA_EXT.has(extOf(f.name));

interface SourceImportProps {
  language: string;
  disabled?: boolean;
  hint: string;
  onExtracted: (ex: Extracted, src: ImportSource) => void;
}

// [serverExtract]: archivo (multipart) o enlace (JSON) → texto con el extractor del servidor | lanza Error con el mensaje del BFF
async function serverExtract(input: File | string, language: string): Promise<{ text: string; title: string }> {
  const init: RequestInit =
    typeof input === "string"
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: input, language }) }
      : (() => {
          const form = new FormData(); // [Web API]: multipart → el navegador pone el boundary
          form.append("file", input);
          form.append("language", language);
          return { method: "POST", body: form };
        })(); // IIFE: arma el FormData sin variables sueltas
  const res = await fetch("/api/media/extract-text", init);
  const data = (await res.json().catch(() => ({}))) as { text?: string; title?: string; message?: string };
  if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
  return { text: data.text ?? "", title: data.title ?? "" };
}

export function SourceImport({ language, disabled = false, hint, onExtracted }: SourceImportProps) {
  const inputId = useId();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [link, setLink] = useState("");
  const lang = language || "en"; // Poliglota no exige idioma: OCR/transcripción en inglés + español

  // [deliver]: entrega el resultado al formulario o explica por qué no hay nada
  const deliver = (ex: Extracted, src: ImportSource) => {
    if (!ex.rows.length && !ex.text.trim()) return setMessage({ ok: false, text: "No se encontró texto en el contenido." });
    onExtracted(ex, src);
    setMessage({ ok: true, text: `Contenido leído de «${src.title || src.label}». Revísalo abajo.` });
  };

  // [onFile]: navegador primero (conserva tablas) · servidor para audio/video y formatos de oficina que el navegador no lee
  const onFile = async (file: File | undefined, url?: string) => {
    if (!file) return;
    setMessage(null);
    const media = isMedia(file);
    const maxMb = media ? MAX_MEDIA_MB : MAX_DOC_MB;
    if (file.size > maxMb * 1024 * 1024) return setMessage({ ok: false, text: `El archivo supera ${maxMb} MB.` });
    setBusy(media ? "Transcribiendo el audio/video… puede tardar" : file.type.startsWith("image/") ? "Leyendo la imagen (OCR)…" : "Leyendo el archivo…");
    try {
      if (media || SERVER_EXT.has(extOf(file.name))) {
        const { text, title } = await serverExtract(file, lang);
        deliver({ rows: [], text }, { label: file.name, title, url });
      } else {
        deliver(await extract(file, lang, (pct) => setBusy(`Reconociendo texto… ${pct}%`)), { label: file.name, url });
      }
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "No se pudo leer el archivo." });
    } finally {
      setBusy(null);
    }
  };

  // [onLink]: página web → tabla + texto · archivo publicado → mismos extractores · tipo no admitido (audio/video…) → servidor (transcripción)
  const onLink = async () => {
    const url = link.trim();
    if (!url || busy) return;
    setMessage(null);
    setBusy("Leyendo el enlace…");
    try {
      const res = await fetch("/api/curriculum/import-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const data = (await res.json().catch(() => ({}))) as { message?: string; kind?: "page" | "file"; rows?: Row[]; text?: string; title?: string; name?: string; type?: string; base64?: string };
      if (res.status === 415) {
        // [Plan B]: audio/video u otro formato → extractor del servidor (descarga anti-SSRF + Whisper)
        setBusy("Transcribiendo el enlace… puede tardar");
        const { text, title } = await serverExtract(url, lang);
        return deliver({ rows: [], text }, { label: url, title, url });
      }
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      if (data.kind === "page") return deliver({ rows: data.rows ?? [], text: data.text ?? "" }, { label: url, title: data.title, url });
      if (data.kind === "file" && data.base64) {
        // `atob` + `Uint8Array.from` (Web APIs): base64 → bytes → File
        const bytes = Uint8Array.from(atob(data.base64), (ch) => ch.charCodeAt(0));
        setBusy(null);
        return await onFile(new File([bytes], data.name ?? "archivo", { type: data.type }), url);
      }
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "No se pudo leer el enlace." });
    } finally {
      setBusy(null);
    }
  };

  const off = disabled || busy !== null;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{hint}</p>
      {/* [Archivo]: <label> del input oculto (sr-only) → foco visible con has-[:focus-visible] */}
      <label htmlFor={inputId} className={`btn btn-outline w-fit cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${off ? "pointer-events-none opacity-50" : ""}`}>
        {busy ?? (
          <>
            <FileText aria-hidden className="size-4" /> Importar archivo
          </>
        )}
        <input
          id={inputId}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={off}
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = ""; // Permite volver a elegir el mismo archivo
          }}
        />
      </label>
      <p className="text-[11px] text-muted-foreground">Excel, CSV, Word, PDF, PowerPoint, texto, imagen (OCR) o audio/video (se transcribe, máx. {MAX_MEDIA_MB} MB).</p>
      {/* [Enlace]: sin <form> anidado → Enter se intercepta */}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`${inputId}-url`} className="sr-only">
          Enlace de una página, documento o audio/video
        </label>
        <input
          id={`${inputId}-url`}
          type="url"
          inputMode="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void onLink();
            }
          }}
          placeholder="https://… (página, PDF, Excel, MP3, MP4)"
          disabled={off}
          className="control min-w-0 flex-1"
        />
        <button type="button" onClick={() => void onLink()} disabled={off || !link.trim()} className="btn btn-outline">
          <Link2 aria-hidden className="size-4" /> Importar enlace
        </button>
      </div>
      {/* `aria-live`: el resultado se anuncia al terminar */}
      <p aria-live="polite" className={`text-xs ${message ? (message.ok ? "text-tone-brand" : "text-tone-danger") : "sr-only"}`}>
        {message?.text ?? ""}
      </p>
    </div>
  );
}
