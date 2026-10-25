import { bffMutation } from "@/lib/bff";
import { apiFetch } from "@/lib/api-client";
import { getCurrentAccessToken } from "@/lib/auth";
// [Route Handler POST /api/courses/draft · 2026-10-23]: BFF → NestJS POST /courses/draft (borrador IA: título + descripción Markdown + etiquetas) | [Patrón]: Proxy (BFF) + Template Method (bffMutation refresca el token) | [Principio]: SRP

export async function POST(request: Request) {
  // `async (body) =>` (ES2017): la cookie httpOnly se convierte en Bearer solo en el servidor
  return bffMutation(request, async (body) => apiFetch("/courses/draft", { method: "POST", body, bearer: (await getCurrentAccessToken()) ?? undefined }));
}
