import { AI_DRAFT_TIMEOUT_MS, AI_TIMEOUT_MESSAGE, bffMutation } from "@/lib/bff";
import { apiFetch } from "@/lib/api-client";
import { getFreshAccessToken } from "@/lib/auth";
// [Route Handler POST /api/courses/draft/topic · 2026-10-25]: BFF → NestJS POST /courses/draft/topic (explicación de un subtema del temario con IA) | [Patrón]: Proxy (BFF)
// [Fix 2026-10-28]: mismo timeout escalonado que /api/courses/draft (SSOT en lib/bff) | [Principio]: DRY

export const maxDuration = 180; // `maxDuration` (Next.js): margen sobre AI_DRAFT_TIMEOUT_MS

export async function POST(request: Request) {
  return bffMutation(request, async (body) =>
    apiFetch("/courses/draft/topic", { method: "POST", body, bearer: (await getFreshAccessToken()) ?? undefined, timeoutMs: AI_DRAFT_TIMEOUT_MS, timeoutMessage: AI_TIMEOUT_MESSAGE }),
  );
}
