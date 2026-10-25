import { bffMutation } from "@/lib/bff";
import { submitAnswer } from "@/lib/quiz-api";
// [Route Handler POST /api/quiz/session/[sessionId]/answer]: envía una respuesta | [Patrón]: Proxy
// [2026-10-23]: vía bffMutation/bffQuery → refresca el access token vencido (antes respondía «Unauthorized») | [Patrón]: Proxy (BFF) + Template Method | [Principio]: DRY

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return bffMutation(request, (body) => submitAnswer(sessionId, body as Parameters<typeof submitAnswer>[1]));
}
