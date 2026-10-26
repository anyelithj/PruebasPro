import { COURSE_CONTENT_MAX_CHARS } from "@/types/courses";
import { extractTextResponse, requireAuthor } from "@/lib/extract-text";
// [Route Handler POST /api/courses/import · 2026-10-24]: «Importar contenido del curso» — archivo (PDF con OCR de escaneos, Word, Excel, imagen, audio…) o enlace → texto + Markdown
// [Por qué una ruta propia]: el contenido del curso es LARGO (columna `text` sin límite) → tope COURSE_CONTENT_MAX_CHARS en vez de los 20 000 de /api/media/extract-text
// [Patrón]: BFF + Guard (solo docentes/admin) + Template Method (lib/extract-text) | [Principio]: DRY + SRP | [Paradigma]: Funcional + asíncrono

export const runtime = "nodejs"; // `runtime` (Next.js): pdf.js, mammoth y Tesseract corren en Node (no en Edge)

export async function POST(request: Request) {
  const denied = await requireAuthor(); // 401/403 si no es docente ni admin
  return denied ?? extractTextResponse(request, COURSE_CONTENT_MAX_CHARS); // `??` (ES2020): sin bloqueo → extrae
}
