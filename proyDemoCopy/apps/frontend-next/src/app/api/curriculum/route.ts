import { bffMutation } from "@/lib/bff";
import { createCurriculumItem } from "@/lib/curriculum-api";
// [Route Handler POST /api/curriculum]: BFF → NestJS POST /curriculum | [Patrón]: Proxy (BFF) | [Principio]: SRP | [Tecnología]: Next.js App Router Route Handler

// `export async function POST` (Next.js): el nombre de la función define el método HTTP atendido
export async function POST(request: Request) {
  return bffMutation(request, (body) => createCurriculumItem(body), 201); // 201 Created
}
