import { bffMutation } from "@/lib/bff";
import { curriculumAiPost } from "@/lib/curriculum-api";
// [Route Handler /api/curriculum/ai/topics]: sugerencias de temas con IA → NestJS POST /curriculum/ai/topics | [Patrón]: BFF

export async function POST(request: Request) {
  return bffMutation(request, (body) => curriculumAiPost("topics", body), 200);
}
