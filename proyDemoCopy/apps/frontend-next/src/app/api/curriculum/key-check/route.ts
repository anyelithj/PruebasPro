import { bffQuery } from "@/lib/bff";
import { curriculumCatalogGet } from "@/lib/curriculum-api";
// [Route Handler GET /api/curriculum/key-check]: disponibilidad de la clave (language, kind, key, excludeId) → NestJS

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.toString();
  return bffQuery(() => curriculumCatalogGet("key-check", query));
}
