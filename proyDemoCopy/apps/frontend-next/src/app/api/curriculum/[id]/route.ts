import { bffMutation } from "@/lib/bff";
import { updateCurriculumItem } from "@/lib/curriculum-api";
// [Route Handler PATCH /api/curriculum/:id]: BFF → NestJS PATCH /curriculum/:id (concurrencia optimista con expectedVersion) | [Patrón]: Proxy (BFF) | [Tecnología]: Next.js Route Handler

// `ctx.params` es una Promise en Next.js 15+ → `await` antes de leer el id
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params; // Desestructuración (ES2015)
  return bffMutation(request, (body) => updateCurriculumItem(id, body));
}
