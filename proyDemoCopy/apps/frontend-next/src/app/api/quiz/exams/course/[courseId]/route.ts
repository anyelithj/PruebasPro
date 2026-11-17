import { bffQuery } from "@/lib/bff";
import { getCourseExam } from "@/lib/quiz-api";
// [Route Handler /api/quiz/exams/course/[courseId] · 2026-11-06]: estado del examen final (la página lo consulta cada pocos segundos mientras se genera) | [Patrón]: Proxy (BFF)

export async function GET(_req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return bffQuery(() => getCourseExam(courseId));
}
