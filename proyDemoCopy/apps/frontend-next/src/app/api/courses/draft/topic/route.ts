import { bffMutation } from "@/lib/bff";
import { apiFetch } from "@/lib/api-client";
import { getCurrentAccessToken } from "@/lib/auth";
// [Route Handler POST /api/courses/draft/topic · 2026-10-25]: BFF → NestJS POST /courses/draft/topic (explicación de un subtema del temario con IA) | [Patrón]: Proxy (BFF)

export async function POST(request: Request) {
  return bffMutation(request, async (body) => apiFetch("/courses/draft/topic", { method: "POST", body, bearer: (await getCurrentAccessToken()) ?? undefined }));
}
