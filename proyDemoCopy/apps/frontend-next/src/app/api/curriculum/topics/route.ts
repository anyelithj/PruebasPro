import { bffMutation, bffQuery } from "@/lib/bff";
import { curriculumCatalogGet, curriculumCatalogPost } from "@/lib/curriculum-api";
// [Route Handler /api/curriculum/topics]: búsqueda (GET) y alta (POST, ADMIN) de temas → NestJS /curriculum/topics

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.toString(); // language, level, skill, kind, search, limit
  return bffQuery(() => curriculumCatalogGet("topics", query));
}

export async function POST(request: Request) {
  return bffMutation(request, (body) => curriculumCatalogPost("topics", body), 201);
}
