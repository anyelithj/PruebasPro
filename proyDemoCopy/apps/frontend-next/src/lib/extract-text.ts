// [Solo servidor]: usa safeFetch (node:*) y librerías de Node → nunca se empaqueta para el navegador
import { NextResponse } from "next/server";
import { parse } from "node-html-parser";
import { getCurrentUserPayload, getFreshAccessToken } from "@/lib/auth";
import { apiUrl } from "@/lib/constants"; // [2026-10-23]: URL de NestJS para la transcripción de audio/video
import { Role } from "@/lib/constants";
import { OCR_LANG } from "@/lib/pdf-text";
import { safeFetch } from "@/lib/safe-fetch";
// [extractText · 2026-10-23]: texto de un archivo (PDF, Word .docx, texto, imagen con OCR) o de un ENLACE (página web o archivo publicado)
// [Uso]: letra de canciones (/musica/subir), diálogos por URL y contenido de actividades → un solo extractor para todo el portal
// [Patrón]: Strategy (extractor por tipo) + Adapter (bytes → texto) | [Principio]: DRY + OCP (formato nuevo = una rama) | [Paradigma]: Funcional + asíncrono
// [Tecnologías]: pdf.js legacy (Node), mammoth (.docx), Tesseract.js (OCR WebAssembly), node-html-parser — todas con `import()` dinámico

export interface ExtractedText {
  title: string; // Título del documento o de la página (si lo hay)
  text: string; // Texto plano, una línea por bloque
  holder: string; // Autor o sitio que declara la página → rellena la licencia
}

export const MAX_TEXT = 20_000; // Tope de caracteres devueltos (= DraftDialogueBody.text de NestJS)
const EMPTY = { title: "", holder: "" };

// [pdfToText]: pdf.js en Node (build legacy, sin worker del navegador) | `getTextContent` por página
async function pdfToText(data: Uint8Array): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs"); // `import()` dinámico (ES2020): solo se carga si llega un PDF
  const task = pdfjs.getDocument({ data, disableFontFace: true }); // Sin fuentes del sistema: solo se lee el texto
  const doc = await task.promise;
  let raw = "";
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const { items } = await (await doc.getPage(p)).getTextContent();
      for (const it of items) if ("str" in it) raw += it.str + (it.hasEOL ? "\n" : ""); // `in` (TS narrowing): solo fragmentos con texto
      raw += "\n";
    }
  } finally {
    void task.destroy(); // Libera memoria aunque falle una página
  }
  return raw;
}

// [ocr]: imagen → texto con Tesseract.js (idioma del contenido + español) | los modelos se descargan una vez y quedan en caché
async function ocr(data: Buffer, language: string): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker([...new Set([OCR_LANG[language] ?? "eng", "spa"])].join("+")); // `Set` (ES2015): sin repetir
  try {
    return (await worker.recognize(data)).data.text;
  } finally {
    await worker.terminate(); // Libera el hilo de OCR
  }
}

// [sheetToText · 2026-10-23]: Excel/ODS/CSV → una línea por fila (celdas separadas por « · ») | SheetJS ya instalado (exportación de recursos)
async function sheetToText(data: Buffer): Promise<string> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(data, { type: "buffer" });
  // `flatMap` (ES2019): todas las hojas; `sheet_to_json` con header:1 → filas como arrays
  return wb.SheetNames.flatMap((n) => [
    wb.SheetNames.length > 1 ? `## ${n}` : "",
    ...XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n]!, { header: 1, blankrows: false }).map((row) => row.map((c) => String(c ?? "").trim()).filter(Boolean).join(" · ")),
  ]).filter(Boolean).join("\n");
}

// [zipXmlText · 2026-10-23 · 4.º pase]: documentos de oficina que son un ZIP de XML — PowerPoint (.pptx), OpenDocument (.odt/.odp) y EPUB
// SheetJS (`XLSX.CFB`, ya instalado) abre el contenedor ZIP → sin dependencia nueva | [Patrón]: Adapter (ZIP+XML → texto) | [Principio]: OCP (otro formato = otra regla)
const XML_ENTITIES: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const xmlText = (xml: string, paragraph: RegExp): string =>
  xml
    .replace(paragraph, "\n") // Fin de párrafo → salto de línea
    .replace(/<[^>]+>/g, "") // Fuera etiquetas
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, e: string) => XML_ENTITIES[e] ?? "")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));
async function zipXmlText(data: Buffer, ext: string): Promise<string> {
  const XLSX = await import("xlsx");
  // `as` (TS): solo las dos listas que se usan del contenedor (FullPaths ↔ FileIndex)
  const zip = XLSX.CFB.read(data, { type: "buffer" }) as unknown as { FullPaths: string[]; FileIndex: Array<{ content?: Uint8Array | number[] }> };
  // `FullPaths[i]` ↔ `FileIndex[i]`: ruta y contenido de cada entrada del ZIP
  const entries = zip.FullPaths.map((path, i) => ({ path: path.replace(/^Root Entry\//, ""), content: zip.FileIndex[i]?.content })).filter((e) => e.content?.length);
  const decode = (c: unknown) => Buffer.from(c as Uint8Array).toString("utf-8");
  if (ext === "pptx") {
    const num = (p: string) => Number(/slide(\d+)\.xml$/.exec(p)?.[1] ?? 0); // Orden real de las diapositivas (slide10 después de slide9)
    return entries
      .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.path))
      .sort((a, b) => num(a.path) - num(b.path))
      .map((e, i) => `## Diapositiva ${i + 1}\n${xmlText(decode(e.content), /<\/a:p>/g)}`)
      .join("\n\n");
  }
  if (ext === "epub") return entries.filter((e) => /\.x?html?$/.test(e.path)).map((e) => htmlToText(decode(e.content)).text).join("\n\n");
  const content = entries.find((e) => e.path === "content.xml"); // OpenDocument (.odt, .odp)
  if (!content) throw new Error("El archivo está dañado o no es un documento de oficina.");
  return xmlText(decode(content.content), /<\/text:(p|h)>/g);
}

// [rtfToText · 2026-10-23 · 4.º pase]: RTF → texto quitando destinos {\* …}, palabras de control y escapes \'hh (cp1252) | ponytail: sin tablas; basta para leer y traducir
const rtfToText = (rtf: string): string =>
  rtf
    .replace(/\\par[d]?/g, "\n")
    .replace(/\{\\\*[^{}]*\}/g, "")
    .replace(/\\'([0-9a-f]{2})/gi, (_, h: string) => Buffer.from([parseInt(h, 16)]).toString("latin1"))
    .replace(/\\u(-?\d+)\??/g, (_, n: string) => String.fromCharCode((Number(n) + 65536) % 65536))
    .replace(/\\[a-z]+-?\d* ?/gi, "")
    .replace(/[{}]/g, "");

// [looksLikeText · 2026-10-23 · 4.º pase]: ¿«cualquier otro» archivo es texto plano (JSON, XML, VTT, código…)? → sin bytes nulos en los primeros 4 KB
// y casi sin caracteres inválidos al decodificar como UTF-8 | [Principio]: Robustez (acepta formatos no listados en vez de rechazarlos)
const looksLikeText = (data: Buffer): boolean => {
  const head = data.subarray(0, 4096);
  if (head.includes(0)) return false;
  const decoded = head.toString("utf-8");
  return (decoded.match(/�/g)?.length ?? 0) < decoded.length / 100;
};

// [transcribe · 2026-10-23]: audio/video → texto con Whisper (NestJS /speech/transcribe → FastAPI) | una línea por frase: un silencio > LINE_GAP_S abre línea nueva (versos de canciones)
const LINE_GAP_S = 0.7;
export const MAX_MEDIA_BYTES = 25 * 1024 * 1024; // = límite de NestJS/FastAPI Speech
async function transcribe(data: Buffer, mime: string, language: string): Promise<string> {
  if (data.length > MAX_MEDIA_BYTES) throw new Error("El audio/video supera 25 MB: recórtalo o usa un MP3.");
  const token = await getFreshAccessToken();
  const form = new FormData(); // [Web API]: multipart hacia NestJS
  form.append("file", new Blob([new Uint8Array(data)], { type: mime }), "media");
  if (/^(en|fr|de|es|pt|zh|ru)$/.test(language)) form.append("language", language);
  const res = await fetch(apiUrl("/speech/transcribe"), { method: "POST", body: form, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const body = (await res.json().catch(() => null)) as { data?: Transcript; message?: string } | null;
  if (!res.ok) throw new Error(body?.message ?? `No se pudo transcribir (HTTP ${res.status}).`);
  const words = (body?.data ?? (body as unknown as Transcript))?.words ?? [];
  // `reduce` (ES5): agrupa palabras en líneas por pausas | [Paradigma]: Funcional
  return words
    .reduce<string[]>((lines, w, i) => {
      const gap = i > 0 ? w.start - words[i - 1]!.end : 0;
      if (i === 0 || gap > LINE_GAP_S) lines.push(w.word.trim());
      else lines[lines.length - 1] += ` ${w.word.trim()}`;
      return lines;
    }, [])
    .join("\n");
}
interface Transcript {
  words: { word: string; start: number; end: number }[];
}

// [htmlToText]: página web → título, autor y texto de los bloques principales (sin menús, scripts ni pies)
function htmlToText(html: string): ExtractedText {
  const root = parse(html);
  const title = root.querySelector("h1")?.text.trim() || root.querySelector("title")?.text.trim() || "";
  const meta = (sel: string) => root.querySelector(sel)?.getAttribute("content")?.trim() ?? "";
  const holder = meta('meta[name="author"]') || meta('meta[property="article:author"]') || meta('meta[property="og:site_name"]') || meta('meta[name="application-name"]');
  root.querySelectorAll("script,style,noscript,nav,header,footer,aside,form,svg").forEach((n) => n.remove()); // Ruido de la página
  const main = root.querySelector("main,article") ?? root;
  const text = main
    .querySelectorAll("p,li,dt,dd,td,blockquote,pre,h2,h3,h4")
    .map((n) => n.text.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  return { title: title.slice(0, 160), text, holder: holder.slice(0, 160) };
}

// [textFromBytes]: elige el extractor por tipo MIME o extensión | [Patrón]: Strategy
export async function textFromBytes(data: Buffer, type: string, name: string, language: string): Promise<ExtractedText> {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const mime = type.split(";")[0].trim().toLowerCase();
  const base = name.replace(/\.[^.]+$/, "").slice(0, 160); // Nombre del archivo sin extensión → título sugerido
  let out: ExtractedText;
  if (mime === "text/html" || mime === "application/xhtml+xml" || ext === "html" || ext === "htm") out = htmlToText(data.toString("utf-8"));
  else if (mime === "application/pdf" || ext === "pdf") out = { ...EMPTY, title: base, text: await pdfToText(new Uint8Array(data)) };
  else if (ext === "docx" || mime.includes("wordprocessingml")) out = { ...EMPTY, title: base, text: (await (await import("mammoth")).extractRawText({ buffer: data })).value };
  else if (mime.startsWith("image/")) out = { ...EMPTY, title: base, text: await ocr(data, language) };
  else if (["xlsx", "xls", "ods", "csv"].includes(ext) || mime.includes("spreadsheet") || mime === "application/vnd.ms-excel") out = { ...EMPTY, title: base, text: await sheetToText(data) };
  else if (mime.startsWith("audio/") || mime.startsWith("video/") || ["mp3", "wav", "m4a", "ogg", "oga", "opus", "mp4", "m4v", "webm", "mov"].includes(ext))
    out = { ...EMPTY, title: base, text: await transcribe(data, mime.startsWith("audio/") || mime.startsWith("video/") ? mime : ext === "mp3" ? "audio/mpeg" : ext === "wav" ? "audio/wav" : ext.startsWith("m4") || ext === "mp4" || ext === "mov" ? "video/mp4" : ext === "webm" ? "video/webm" : "audio/ogg", language) };
  // [2026-10-23 · 4.º pase]: PowerPoint, OpenDocument y EPUB (ZIP de XML) + RTF
  else if (["pptx", "odt", "odp", "epub"].includes(ext) || mime.includes("presentationml") || mime.includes("opendocument.text") || mime.includes("opendocument.presentation") || mime === "application/epub+zip")
    out = { ...EMPTY, title: base, text: await zipXmlText(data, ["pptx", "odt", "odp", "epub"].includes(ext) ? ext : mime.includes("presentationml") ? "pptx" : mime === "application/epub+zip" ? "epub" : "odt") };
  else if (ext === "rtf" || mime === "application/rtf" || mime === "text/rtf") out = { ...EMPTY, title: base, text: rtfToText(data.toString("latin1")) };
  else if (mime.startsWith("text/") || ["txt", "srt", "lrc", "md"].includes(ext)) out = { ...EMPTY, title: base, text: data.toString("utf-8") };
  else if (ext === "doc" || ext === "ppt") throw new Error(`Los .${ext} antiguos no se pueden leer: guárdalo como .${ext}x desde Office.`);
  else if (looksLikeText(data)) out = { ...EMPTY, title: base, text: data.toString("utf-8") }; // [2026-10-23 · 4.º pase]: JSON, XML, VTT, código… cualquier archivo de texto
  else throw new Error(`Formato no admitido (${mime || ext || "desconocido"}). Usa PDF, Word, PowerPoint, Excel, OpenDocument, texto, imagen, audio/video o un enlace.`);
  // [Limpieza]: espacios repetidos fuera, líneas vacías múltiples → una
  const text = out.text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_TEXT);
  if (!text) throw new Error("El archivo no tiene texto que se pueda leer.");
  return { ...out, text };
}

// [textFromUrl]: descarga con protección SSRF (safeFetch) y extrae según lo que devuelva el enlace (HTML, PDF, imagen…)
export async function textFromUrl(url: string, language = "en"): Promise<ExtractedText> {
  const res = await safeFetch(url);
  const name = new URL(res.url).pathname.split("/").pop() ?? "";
  return textFromBytes(res.body, res.contentType, name, language);
}

// [toMarkdown · 2026-10-23]: texto plano extraído → Markdown legible (títulos, viñetas, párrafos) sin LLM | heurística: línea corta sin punto final = título | [Paradigma]: Funcional (pura)
export function toMarkdown(text: string, title = ""): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const out = title ? [`# ${title}`, ""] : [];
  for (const l of lines) {
    if (!l) { if (out.at(-1) !== "") out.push(""); continue; } // Línea vacía = separador de párrafo (una sola)
    if (/^[-*•–]\s+/.test(l)) out.push(`- ${l.replace(/^[-*•–]\s+/, "")}`); // Viñeta
    else if (/^\d+[.)]\s+/.test(l)) out.push(l.replace(/^(\d+)[)]/, "$1.")); // Lista numerada
    else if (l.length <= 70 && !/[.,;:!?]$/.test(l) && /^\p{Lu}/u.test(l) && !l.startsWith("#")) out.push("", `## ${l}`, ""); // Título de sección
    else out.push(l);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// [requireUser · 2026-10-23]: 401 o null — el traductor lo usan también los estudiantes (subir un documento y traducirlo)
export async function requireUser(): Promise<NextResponse | null> {
  return (await getCurrentUserPayload()) ? null : NextResponse.json({ message: "Inicia sesión." }, { status: 401 });
}

// [requireAuthor]: 401/403 o null si puede importar | lo usan /api/media/extract-text y /api/dialogues/import-url
export async function requireAuthor(): Promise<NextResponse | null> {
  const user = await getCurrentUserPayload();
  if (!user) return NextResponse.json({ message: "Inicia sesión." }, { status: 401 });
  if (user.role !== Role.TEACHER && user.role !== Role.ADMIN) return NextResponse.json({ message: "No tienes permiso para importar contenido." }, { status: 403 });
  return null;
}
