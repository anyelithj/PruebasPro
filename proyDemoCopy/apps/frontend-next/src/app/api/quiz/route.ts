import { NextResponse } from "next/server";
import { createQuiz } from "@/lib/quiz-api";
import { getFreshAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import type { CreateQuizInput } from "@/types/quiz";
// [Route Handler /api/quiz POST]: Next.js → NestJS proxy para creación de quiz | [Patron]: Proxy + Facade | [Principio]: SRP

export async function POST(request: Request): Promise<NextResponse> {
  let body: CreateQuizInput;
  try {
    body = (await request.json()) as CreateQuizInput;
  } catch {
    return NextResponse.json({ message: "JSON inválido" }, { status: 400 });
  }

  try {
    // [Refresca token antes de mutar]: el form de creación puede haber estado abierto > TTL (15m) → evita 401 | [Patrón]: Token Refresh
    await getFreshAccessToken();
    const quiz = await createQuiz(body);
    return NextResponse.json(quiz, { status: 201 });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message = err instanceof ApiError ? err.message : "Error creando quiz";
    return NextResponse.json({ message }, { status });
  }
}
