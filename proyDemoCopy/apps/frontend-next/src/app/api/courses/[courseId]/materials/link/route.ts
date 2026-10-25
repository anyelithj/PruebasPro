import { streamToBackend } from "@/lib/stream-proxy";
// [Route Handler POST /api/courses/:courseId/materials/link · 2026-10-23]: adjunta un enlace externo (YouTube, artículo, podcast) como material | [Patrón]: Proxy (BFF) | [Principio]: DRY (mismo proxy que la subida de archivos)

export async function POST(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return streamToBackend(request, `/courses/${encodeURIComponent(courseId)}/materials/link`); // `encodeURIComponent` (JS): evita inyectar rutas
}
