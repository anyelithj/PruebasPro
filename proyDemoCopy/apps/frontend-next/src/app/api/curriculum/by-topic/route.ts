import { streamToBackend } from "@/lib/stream-proxy";
// [Route Handler GET /api/curriculum/by-topic · 2026-10-23]: recursos agrupados por tema → NestJS GET /curriculum/by-topic (el selector de contenidos de Práctica en Angular lo usa)
// [Patrón]: Proxy (BFF) | [Principio]: DRY (streamToBackend: cookie httpOnly → Bearer) | [Ruta estática]: gana a /api/curriculum/[id]

export async function GET(request: Request) {
  return streamToBackend(request, `/curriculum/by-topic${new URL(request.url).search}`);
}
