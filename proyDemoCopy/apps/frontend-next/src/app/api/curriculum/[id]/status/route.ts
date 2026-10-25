import { bffMutation } from "@/lib/bff";
import { changeCurriculumStatus } from "@/lib/curriculum-api";
// [Route Handler POST /api/curriculum/:id/status]: BFF → NestJS POST /curriculum/:id/status (flujo editorial) | [Patrón]: Proxy (BFF) | [Tecnología]: Next.js Route Handler

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return bffMutation(request, (body) => changeCurriculumStatus(id, body));
}
