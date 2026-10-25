import { bffQuery } from "@/lib/bff";
import { purchaseCourse } from "@/lib/courses-api"; // [Facade]: POST /courses/:id/purchase con el Bearer de la cookie httpOnly
// [Route Handler POST /api/courses/[courseId]/purchase]: inscripción/compra | [Patrón]: Proxy
// [2026-10-23]: vía bffMutation/bffQuery → refresca el access token vencido (antes respondía «Unauthorized») | [Patrón]: Proxy (BFF) + Template Method | [Principio]: DRY

export async function POST(_request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params; // `await` (ES2017): resuelve los params dinámicos
  return bffQuery(() => purchaseCourse(courseId));
}
