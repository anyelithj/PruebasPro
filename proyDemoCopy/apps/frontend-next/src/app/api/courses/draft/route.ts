import { AI_DRAFT_TIMEOUT_MS, AI_TIMEOUT_MESSAGE, bffMutation } from "@/lib/bff";
import { apiFetch } from "@/lib/api-client";
import { getFreshAccessToken } from "@/lib/auth";
// [Route Handler POST /api/courses/draft · 2026-10-23]: BFF → NestJS POST /courses/draft (borrador IA: título + descripción Markdown + etiquetas) | [Patrón]: Proxy (BFF) + Template Method (bffMutation refresca el token) | [Principio]: SRP
// [Fix 2026-10-28]: timeout explícito (AbortSignal) + mensaje «La IA tardó demasiado…» (504) → antes undici cortaba a los 300 s con un 503 genérico

export const maxDuration = 180; // `maxDuration` (segment config de Next.js, segundos): plataformas de despliegue no cortan antes que nuestro propio timeout

export async function POST(request: Request) {
  // `async (body) =>` (ES2017): la cookie httpOnly se convierte en Bearer solo en el servidor
  return bffMutation(request, async (body) =>
    apiFetch("/courses/draft", { method: "POST", body, bearer: (await getFreshAccessToken()) ?? undefined, timeoutMs: AI_DRAFT_TIMEOUT_MS, timeoutMessage: AI_TIMEOUT_MESSAGE }),
  );
}
