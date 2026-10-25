import { bffMutation } from "@/lib/bff";
import { curriculumAiPost } from "@/lib/curriculum-api";
// [Route Handler /api/curriculum/ai/content]: genera con IA un borrador de contenido → NestJS POST /curriculum/ai/content | [Patrón]: BFF (Backend For Frontend) | [Seguridad]: el JWT viaja desde la cookie httpOnly solo en el servidor

// `export async function POST` (Next.js App Router): handler del método HTTP | 200: consulta, no crea recurso
export async function POST(request: Request) {
  return bffMutation(request, (body) => curriculumAiPost("content", body), 200);
}
