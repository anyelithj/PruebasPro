import { bffQuery } from "@/lib/bff";
import { reactivateUser } from "@/lib/quiz-api";
// [Route Handler POST /api/admin/users/[id]/activate]: reactivar usuario | [Patrón]: Proxy
// [2026-10-23]: vía bffMutation/bffQuery → refresca el access token vencido (antes respondía «Unauthorized») | [Patrón]: Proxy (BFF) + Template Method | [Principio]: DRY

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return bffQuery(() => reactivateUser(id), 204);
}
