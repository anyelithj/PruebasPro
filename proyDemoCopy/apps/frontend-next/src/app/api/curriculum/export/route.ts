import { streamToBackend } from "@/lib/stream-proxy";
// [Route Handler GET /api/curriculum/export · 2026-10-23]: descarga de recursos (PDF, Word, Excel o CSV) → NestJS GET /curriculum/export con la cookie httpOnly como Bearer
// [Patrón]: Proxy (BFF) en flujo — el archivo binario pasa sin cargarse en memoria | [Principio]: DRY (streamToBackend) | [Ruta estática]: gana a /api/curriculum/[id]

export async function GET(request: Request) {
  return streamToBackend(request, `/curriculum/export${new URL(request.url).search}`); // `URL.search`: conserva los filtros y el formato
}
