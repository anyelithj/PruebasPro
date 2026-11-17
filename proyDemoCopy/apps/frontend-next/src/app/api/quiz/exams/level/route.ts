import type { NextRequest } from "next/server";
import { bffQuery } from "@/lib/bff";
import { getLevelExam } from "@/lib/quiz-api";
// [Route Handler /api/quiz/exams/level?language=&level= · 2026-11-06]: estado del examen de nivel | [Patrón]: Proxy (BFF)

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  return bffQuery(() => getLevelExam(q.get("language") ?? "", q.get("level") ?? ""));
}
