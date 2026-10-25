import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api-client";
import { getCurrentAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
// [Route /api/ai/feedback]: Next.js → NestJS proxy para feedback ad-hoc | [Patron]: Proxy + Facade | [Principio]: SRP

interface GenerateFeedbackBody {
  questionId: string;
  questionText: string;
  correctAnswer: string;
  userAnswer: string;
  topic?: string;
  language?: "es" | "en";
}

interface FeedbackResult {
  question_id: string;
  feedback_type: string;
  message: string;
  suggestion: string | null;
  references: string[];
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: GenerateFeedbackBody;
  try {
    body = (await request.json()) as GenerateFeedbackBody;
  } catch {
    return NextResponse.json({ message: "JSON inválido" }, { status: 400 });
  }

  // [Validación mínima]: el backend valida a fondo con class-validator | [Principio]: KISS
  if (!body.questionText || !body.correctAnswer) {
    return NextResponse.json(
      { message: "questionText y correctAnswer son obligatorios" },
      { status: 400 },
    );
  }

  const bearer = (await getCurrentAccessToken()) ?? undefined;
  try {
    const result = await apiFetch<FeedbackResult | null>("/ai/feedback/generate", {
      method: "POST",
      body: {
        ...body,
        questionId: body.questionId || "ad-hoc",
        language: body.language ?? "es",
      },
      bearer,
    });
    return NextResponse.json(result);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message = err instanceof ApiError ? err.message : "Error generando feedback";
    return NextResponse.json({ message }, { status });
  }
}
