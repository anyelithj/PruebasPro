import { streamToBackend } from "@/lib/stream-proxy";
// [Route Handler /api/courses/:courseId/materials]: listar (GET) y subir (POST multipart en streaming) materiales → NestJS | [Patrón]: BFF + Proxy

// `params: Promise<…>` (Next.js 15+): los parámetros dinámicos llegan como Promise
type Ctx = { params: Promise<{ courseId: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { courseId } = await params;
  return streamToBackend(request, `/courses/${encodeURIComponent(courseId)}/materials`); // `encodeURIComponent` (JS): evita inyectar rutas
}

export async function POST(request: Request, { params }: Ctx) {
  const { courseId } = await params;
  return streamToBackend(request, `/courses/${encodeURIComponent(courseId)}/materials`);
}
