import { bffMutation, bffQuery } from "@/lib/bff";
import { curriculumCatalogGet, curriculumCatalogPost } from "@/lib/curriculum-api";
// [Route Handler /api/curriculum/sources]: búsqueda (GET) y alta (POST, ADMIN) de fuentes → NestJS /curriculum/sources

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.toString(); // search, limit
  return bffQuery(() => curriculumCatalogGet("sources", query));
}

export async function POST(request: Request) {
  return bffMutation(request, (body) => curriculumCatalogPost("sources", body), 201);
}
