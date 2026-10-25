import { bffMutation, bffQuery } from "@/lib/bff";
import { deactivateUser, updateUser, type UpdateUserInput } from "@/lib/quiz-api";
// [Route Handler /api/admin/users/[id]]: PATCH edit + DELETE soft-disable | [Patron]: Proxy
// [2026-10-23]: vía bffMutation/bffQuery → refresca el access token vencido (antes respondía «Unauthorized») | [Patrón]: Proxy (BFF) + Template Method | [Principio]: DRY

type Ctx = { params: Promise<{ id: string }> }; // [Next.js 15+]: params asíncronos

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return bffQuery(() => deactivateUser(id), 204);
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  return bffMutation(request, (body) => updateUser(id, body as UpdateUserInput));
}
