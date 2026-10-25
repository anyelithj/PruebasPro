import { streamToBackend } from "@/lib/stream-proxy";
// [Route Handler …/materials/:id/file]: reproducir video / abrir PDF en streaming con Range (se puede adelantar el video) | [Patrón]: BFF + Proxy

type Ctx = { params: Promise<{ courseId: string; id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { courseId, id } = await params;
  return streamToBackend(request, `/courses/${encodeURIComponent(courseId)}/materials/${encodeURIComponent(id)}/file`);
}
