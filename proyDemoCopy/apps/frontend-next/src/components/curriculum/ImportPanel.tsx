"use client"; // [Next.js]: Client Component → lee archivos locales con APIs del navegador
import { Download, FileText } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis)
import { useId, useState } from "react";
import { pdfText, OCR_LANG } from "@/lib/pdf-text"; // [DRY]: idiomas de OCR compartidos con el lector de PDF
import { IMPORTABLE_KINDS, rowsToContents, templateCsv, templateRows, textToRows, type Row } from "@/lib/resource-import";
import type { CurriculumItemKind } from "@/types/curriculum";
// [ImportPanel]: importa una lista de vocabulario, frases… desde Excel/CSV, Word, PDF, texto, imágenes (OCR) o el ENLACE de una página web y la convierte en elementos editables del formulario
// [Tecnologías]: SheetJS (xlsx/xls/csv/ods), mammoth (docx → HTML con tablas), pdf.js (PDF), Tesseract.js (OCR WebAssembly) — todas cargadas con `import()` dinámico
// [Patrón]: Strategy (extractor por formato) + Adapter (archivo → filas) | [Principio]: SRP + OCP (nuevo formato = nuevo extractor) | [Paradigma]: Asíncrono + Funcional
// [Privacidad y software verde]: el archivo se procesa en el navegador; no se sube al servidor. Solo se guardan los elementos que el autor confirme.

const MAX_MB = 15; // Tope de tamaño por archivo
const SHEETS = ["xlsx", "xlsm", "xls", "csv", "tsv", "ods"];
// `accept` del <input type="file">: extensiones + imágenes de cualquier formato que el navegador sepa decodificar
const ACCEPT = ".xlsx,.xlsm,.xls,.csv,.tsv,.ods,.docx,.pdf,.txt,image/*";
// [Idiomas OCR]: código de Tesseract por idioma del recurso (+ español para las traducciones)

// [sheetRows]: primera hoja con datos → filas de texto | SheetJS `sheet_to_json` con `header: 1` (matriz)
async function sheetRows(file: File): Promise<Row[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer()); // Detecta formato y separador (CSV con , o ;)
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: false, blankrows: false });
    const clean = rows.map((r) => r.map((c) => String(c ?? "").trim())).filter((r) => r.some(Boolean));
    if (clean.length) return clean;
  }
  return [];
}

// [docxRows]: Word → si hay tablas, cada fila de tabla es un elemento; si no, cada línea de texto | mammoth + DOMParser (Web API)
async function docxRows(file: File): Promise<Row[]> {
  const mammoth = await import("mammoth");
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  const doc = new DOMParser().parseFromString(html, "text/html"); // Parseo seguro: no se inserta en la página
  const tableRows = [...doc.querySelectorAll("tr")].map((tr) => [...tr.querySelectorAll("td,th")].map((td) => td.textContent?.trim() ?? ""));
  if (tableRows.some((r) => r.some(Boolean))) return tableRows.filter((r) => r.some(Boolean));
  return textToRows([...doc.querySelectorAll("p,li")].map((p) => p.textContent ?? "").join("\n"));
}

// [imageRows]: OCR con Tesseract.js (WebAssembly en un worker) | los modelos del idioma se descargan una vez y quedan en caché del navegador
async function imageRows(file: File, language: string, onProgress: (pct: number) => void): Promise<Row[]> {
  const { createWorker } = await import("tesseract.js");
  const langs = [...new Set([OCR_LANG[language] ?? "eng", "spa"])].join("+"); // `Set` (ES2015): sin repetir si el curso es de español
  const worker = await createWorker(langs, 1, { logger: (m: { status: string; progress: number }) => m.status === "recognizing text" && onProgress(Math.round(m.progress * 100)) });
  try {
    const { data } = await worker.recognize(file);
    return textToRows(data.text);
  } finally {
    await worker.terminate(); // Libera la memoria del worker
  }
}

// [extractRows]: elige el extractor según la extensión o el tipo MIME | [Patrón]: Strategy
async function extractRows(file: File, language: string, onProgress: (pct: number) => void): Promise<Row[]> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (SHEETS.includes(ext)) return sheetRows(file);
  if (ext === "docx") return docxRows(file);
  if (ext === "pdf" || file.type === "application/pdf") return textToRows(await pdfText({ data: await file.arrayBuffer() }));
  if (ext === "txt" || file.type.startsWith("text/")) return textToRows(await file.text());
  if (file.type.startsWith("image/")) return imageRows(file, language, onProgress);
  if (ext === "doc") throw new Error("Los .doc antiguos no se pueden leer: guárdalo como .docx desde Word.");
  throw new Error("Formato no admitido. Usa Excel, CSV, Word (.docx), PDF, texto o una imagen.");
}

export interface ImportPanelProps {
  kind: CurriculumItemKind;
  language: string;
  disabled?: boolean;
  variant?: "card" | "button"; // Tarjeta grande (elegir cómo crear) o botón compacto (añadir más)
  onImport: (contents: Record<string, unknown>[]) => void;
}

// [autofill · 2026-10-23]: completa lo que el archivo/enlace no trae — traducción e IPA (UK por defecto en inglés; la ficha muestra UK/US con interruptor) — con la misma consulta cacheada del editor (/api/vocabulary/lookup) | [Patrón]: Enricher + Retry (429) | [Principio]: DRY (no se duplica el traductor)
// ponytail: los EJEMPLOS no se generan aquí (una llamada al LLM por palabra = minutos); se generan por lote con «Generar con IA» del formulario
interface Lookup {
  ipa: string | null;
  ipa_uk: string | null;
  translation: { translation: string };
}
async function lookup(text: string, language: string, tries = 4): Promise<Lookup | null> {
  const res = await fetch("/api/vocabulary/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language, text }) });
  if (res.status === 429 && tries > 0) {
    await new Promise((r) => setTimeout(r, 15_000)); // Límite de envíos → espera la ventana del throttler
    return lookup(text, language, tries - 1);
  }
  if (!res.ok) return null; // [Fail-soft]: el autor completa a mano
  const body = (await res.json().catch(() => null)) as { data?: { result?: Lookup }; result?: Lookup } | null;
  return body?.data?.result ?? body?.result ?? null;
}
const blank = (v: unknown) => typeof v !== "string" || !v.trim();
const IPA_VARIANT: Readonly<Record<string, string>> = { en: "en-GB", es: "es-ES", fr: "fr-FR", de: "de-DE", pt: "pt-BR", zh: "zh-CN", ru: "ru-RU" };

async function autofill(kind: CurriculumItemKind, items: Record<string, unknown>[], language: string, onStep: (n: number) => void): Promise<number> {
  let filled = 0;
  for (const [i, c] of items.entries()) {
    onStep(i + 1);
    const ipa = c.ipa as { value?: string } | undefined;
    const term = String(c.lemma ?? c.text ?? c.source ?? "");
    const needTr = kind === "vocabulary" || kind === "example" ? blank(c.translationEs) : kind === "translation" ? blank(c.targetEs) : false;
    const needIpa = (kind === "vocabulary" || kind === "pronunciation") && language !== "es" && blank(ipa?.value);
    if (!term || (!needTr && !needIpa)) continue;
    const r = await lookup(term, language);
    if (!r) continue;
    const tr = r.translation?.translation?.trim();
    // [Mutación local]: `items` es una copia recién creada por rowsToContents → no afecta estado de React
    if (needTr && tr && tr.toLowerCase() !== term.toLowerCase()) c[kind === "translation" ? "targetEs" : "translationEs"] = tr;
    const value = (language === "en" ? r.ipa_uk : r.ipa) ?? r.ipa;
    if (needIpa && value) c.ipa = { value: `/${value.replace(/^\/|\/$/g, "")}/`, variant: IPA_VARIANT[language] ?? language, source: "espeak-ng (automático)" };
    filled += 1;
  }
  return filled;
}

export function ImportPanel({ kind, language, disabled = false, variant = "button", onImport }: ImportPanelProps) {
  const inputId = useId();
  const [busy, setBusy] = useState<string | null>(null); // Mensaje de progreso
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [link, setLink] = useState(""); // Enlace de una página web o de un archivo publicado
  const supported = IMPORTABLE_KINDS.has(kind);

  // [finish]: filas → contenidos → formulario + resumen | [Principio]: DRY (archivo y enlace)
  // [2026-10-23]: async → tras leer, completa traducción/IPA que falten antes de entregar los elementos al formulario
  const finish = async (rows: Row[], source: string) => {
    const { contents, skipped } = rowsToContents(kind, rows, language);
    if (!contents.length) return setMessage({ ok: false, text: "No se encontraron elementos. Usa una fila o línea por elemento (por ejemplo «apple - manzana»)." });
    const filled = await autofill(kind, contents, language, (n) => setBusy(`Completando traducción y pronunciación… ${n}/${contents.length}`));
    onImport(contents);
    const missing = contents.filter((c) => blank(c.translationEs ?? c.targetEs ?? c.correct ?? (c.ipa as { value?: string } | undefined)?.value)).length;
    const extra = [skipped ? `${skipped} omitidos (vacíos o repetidos)` : "", filled ? `${filled} completados automáticamente (traducción/IPA)` : "", missing ? `${missing} incompletos: complétalos antes de guardar` : ""].filter(Boolean).join(" · ");
    setMessage({ ok: true, text: `Se importaron ${contents.length} elementos de «${source}».${extra ? ` ${extra}.` : ""} Revísalos abajo.` });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    if (file.size > MAX_MB * 1024 * 1024) return setMessage({ ok: false, text: `El archivo supera ${MAX_MB} MB.` });
    setBusy(file.type.startsWith("image/") ? "Leyendo la imagen (OCR)… puede tardar la primera vez" : "Leyendo el archivo…");
    try {
      await finish(await extractRows(file, language, (pct) => setBusy(`Reconociendo texto… ${pct}%`)), file.name);
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "No se pudo leer el archivo." });
    } finally {
      setBusy(null);
    }
  };

  // [Importar enlace]: el BFF descarga la página (anti-SSRF) → filas de HTML o el archivo para los extractores locales
  const onLink = async () => {
    const url = link.trim();
    if (!url || busy) return;
    setMessage(null);
    setBusy("Leyendo el enlace…");
    try {
      const res = await fetch("/api/curriculum/import-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const data = (await res.json()) as { message?: string; kind?: "rows" | "file"; rows?: Row[]; title?: string; name?: string; type?: string; base64?: string };
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      if (data.kind === "rows") await finish(data.rows ?? [], data.title || url);
      else if (data.kind === "file" && data.base64) {
        // `atob` + `Uint8Array.from` (Web APIs): base64 → bytes → File
        const bytes = Uint8Array.from(atob(data.base64), (ch) => ch.charCodeAt(0));
        setBusy(null);
        await onFile(new File([bytes], data.name ?? "archivo", { type: data.type }));
        return;
      }
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "No se pudo leer el enlace." });
    } finally {
      setBusy(null);
    }
  };

  // [Plantilla]: CSV generado en el navegador con `Blob` + `URL.createObjectURL` (Web APIs)
  // [Plantilla · 2026-10-23]: CSV o Excel (.xlsx con SheetJS) | `Blob` + enlace temporal → descarga sin servidor
  const downloadTemplate = async (format: "csv" | "xlsx") => {
    let blob: Blob | null = null;
    if (format === "csv") {
      const csv = templateCsv(kind);
      if (csv) blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    } else {
      const rows = templateRows(kind);
      if (rows) {
        const XLSX = await import("xlsx"); // `import()` dinámico: SheetJS solo se descarga al pedir la plantilla
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Plantilla");
        blob = new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      }
    }
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: `plantilla-${kind}.${format}` }).click();
    URL.revokeObjectURL(url);
  };

  if (!supported) {
    return variant === "card" ? (
      <p className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
        <FileText aria-hidden className="inline size-4 align-[-0.125em]" /> La importación desde archivo está disponible para vocabulario, frases, traducciones, pronunciación y errores frecuentes.
      </p>
    ) : null;
  }

  const input = (
    <input
      id={inputId}
      type="file"
      accept={ACCEPT}
      className="sr-only"
      disabled={disabled || busy !== null}
      onChange={(e) => {
        void onFile(e.target.files?.[0]);
        e.target.value = ""; // Permite volver a elegir el mismo archivo
      }}
    />
  );

  return (
    <div className="space-y-2">
      {variant === "card" ? (
        // [Tarjeta]: <label> asociado al input → clic en toda la tarjeta; foco visible con has-[:focus-visible]
        <label
          htmlFor={inputId}
          aria-disabled={disabled}
          className={`flex cursor-pointer flex-col items-start gap-1 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${disabled ? "pointer-events-none opacity-50" : ""}`}
        >
          <span className="text-base font-bold">{busy ?? <><FileText aria-hidden className="inline size-4 align-[-0.125em]" /> Importar archivo</>}</span>
          <span className="text-xs text-muted-foreground">Excel, CSV, Word, PDF, texto, imagen o el enlace de una página web. Una fila o línea por elemento: «palabra - traducción».</span>
          {input}
        </label>
      ) : (
        // [Botón de archivo · 2026-10-23 · 4.º pase]: `w-fit` → no se estira; enlace y plantilla quedan cada uno en su fila debajo
        <label htmlFor={inputId} className={`btn btn-outline btn-sm w-fit cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${disabled || busy ? "pointer-events-none opacity-50" : ""}`}>
          {busy ?? <><FileText aria-hidden className="inline size-4 align-[-0.125em]" /> Importar archivo</>}
          {input}
        </label>
      )}
      {/* [Desde un enlace]: sin <form> anidado (ya estamos dentro del formulario) → Enter se intercepta para no enviar el recurso */}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`${inputId}-url`} className="sr-only">
          Enlace de una página web o archivo
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
          placeholder="https://… (página web, PDF, Excel)"
          disabled={disabled || busy !== null}
          className="control min-w-0 flex-1 text-xs"
        />
        <button type="button" onClick={() => void onLink()} disabled={disabled || busy !== null || !link.trim()} className="btn btn-outline btn-sm">
          Importar enlace
        </button>
      </div>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-primary">
        <span className="inline-flex items-center gap-1 text-muted-foreground"><Download aria-hidden className="size-3.5" /> Descargar plantilla:</span>
        <button type="button" onClick={() => void downloadTemplate("xlsx")} className="underline-offset-2 hover:underline">
          Excel (.xlsx)
        </button>
        <button type="button" onClick={() => void downloadTemplate("csv")} className="underline-offset-2 hover:underline">
          CSV
        </button>
      </span>
      {/* `aria-live`: el resultado se anuncia al terminar la lectura */}
      <p aria-live="polite" className={`text-xs ${message ? (message.ok ? "text-tone-brand" : "text-tone-danger") : "sr-only"}`}>
        {message?.text ?? ""}
      </p>
    </div>
  );
}
