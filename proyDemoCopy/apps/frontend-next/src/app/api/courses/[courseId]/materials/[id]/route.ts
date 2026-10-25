import { streamToBackend } from "@/lib/stream-proxy";
// [Route Handler /api/courses/:courseId/materials/:id]: quitar un material (DELETE, ADMIN) → NestJS | [Patrón]: BFF

type Ctx = { params: Promise<{ courseId: string; id: string }> };

export async function DELETE(request: Request, { params }: Ctx) {
  const { courseId, id } = await params;
  return streamToBackend(request, `/courses/${encodeURIComponent(courseId)}/materials/${encodeURIComponent(id)}`);
}
