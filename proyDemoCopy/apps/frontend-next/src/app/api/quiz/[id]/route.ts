import { bffMutation, bffQuery } from "@/lib/bff";
import { deleteQuiz, patchQuiz } from "@/lib/quiz-api";
// [Route Handler /api/quiz/[id]]: PATCH (título, publicar…) + DELETE | [Patrón]: Proxy
// [2026-10-23]: vía bffMutation/bffQuery → refresca el access token vencido (antes respondía «Unauthorized») | [Patrón]: Proxy (BFF) + Template Method | [Principio]: DRY

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  return bffMutation(request, (body) => patchQuiz(id, body as Parameters<typeof patchQuiz>[1])); // `Parameters<>` (TS): tipo del 2.º argumento sin duplicarlo
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return bffQuery(() => deleteQuiz(id), 204);
}
