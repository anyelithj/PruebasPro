import { AI_DRAFT_TIMEOUT_MS, AI_TIMEOUT_MESSAGE, bffMutation } from "@/lib/bff";
import { apiFetch } from "@/lib/api-client";
import { getFreshAccessToken } from "@/lib/auth";
// [Route Handler /api/curriculum/ai/content]: genera con IA un borrador de contenido → NestJS POST /curriculum/ai/content | [Patrón]: BFF (Backend For Frontend) | [Seguridad]: el JWT viaja desde la cookie httpOnly solo en el servidor
// [Fix 2026-11-13]: mismo plazo escalonado que los borradores de curso (170 s) → 504 con mensaje claro en vez de esperar los 300 s de undici

export const maxDuration = 180; // `maxDuration` (Next.js): margen sobre AI_DRAFT_TIMEOUT_MS

// `export async function POST` (Next.js App Router): handler del método HTTP | 200: consulta, no crea recurso
export async function POST(request: Request) {
  return bffMutation(
    request,
    async (body) => apiFetch("/curriculum/ai/content", { method: "POST", body, bearer: (await getFreshAccessToken()) ?? undefined, timeoutMs: AI_DRAFT_TIMEOUT_MS, timeoutMessage: AI_TIMEOUT_MESSAGE }),
    200,
  );
}
