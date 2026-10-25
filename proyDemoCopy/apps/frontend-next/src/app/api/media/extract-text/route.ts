import { NextResponse } from "next/server";
import { MAX_MEDIA_BYTES, requireUser, textFromBytes, textFromUrl, toMarkdown } from "@/lib/extract-text";
// [Route Handler POST /api/media/extract-text · 2026-10-23]: texto de un ARCHIVO (multipart: PDF, Word, texto, imagen con OCR) o de un ENLACE (JSON { url })
// [Uso]: letra de canciones, cursos, traductor y actividades | [Patrón]: BFF + Strategy (lib/extract-text) + Guard
// [Principio]: DRY (mismo extractor que /api/dialogues/import-url) + sesión obligatoria (2026-10-23: también estudiantes, para el traductor) | [Paradigma]: Funcional + asíncrono

export const runtime = "nodejs"; // `runtime` (Next.js): pdf.js, mammoth y Tesseract corren en Node
const MAX_BYTES = MAX_MEDIA_BYTES; // [2026-10-23]: 25 MB (audio/video para transcribir); documentos suelen pesar mucho menos

// [withMarkdown · 2026-10-23]: además del texto plano devuelve su versión Markdown (cursos, material de estudio) | [Principio]: OCP (campo nuevo, los consumidores viejos lo ignoran)
const withMarkdown = <T extends { text: string; title: string }>(x: T) => ({ ...x, markdown: toMarkdown(x.text, x.title) });

export async function POST(request: Request) {
  const denied = await requireUser(); // [2026-10-23]: cualquier usuario con sesión (traductor de estudiantes); antes solo docentes/admin
  if (denied) return denied;
  try {
    // [Dos entradas]: multipart con `file` (+ `language`) o JSON con `url` (+ `language`)
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const language = String(form.get("language") ?? "en");
      if (!(file instanceof File)) return NextResponse.json({ message: "Elige un archivo." }, { status: 400 });
      if (file.size > MAX_BYTES) return NextResponse.json({ message: "El archivo supera 25 MB." }, { status: 413 });
      return NextResponse.json(withMarkdown(await textFromBytes(Buffer.from(await file.arrayBuffer()), file.type, file.name, language)));
    }
    const body = (await request.json().catch(() => ({}))) as { url?: unknown; language?: unknown };
    if (typeof body.url !== "string" || !URL.canParse(body.url)) return NextResponse.json({ message: "Escribe un enlace válido (https://…)." }, { status: 400 });
    return NextResponse.json(withMarkdown(await textFromUrl(body.url, typeof body.language === "string" ? body.language : "en")));
  } catch (err) {
    return NextResponse.json({ message: err instanceof Error ? err.message : "No se pudo leer el contenido." }, { status: 422 });
  }
}
