import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api-client";
import { getFreshAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { DEFAULT_LANGUAGE, isLanguage } from "@/lib/languages";
// [Route Handler /api/quiz/ai/generate]: BFF proxy Next.js → NestJS para generación AI de preguntas | [Patrón]: Proxy + Facade | [Principio]: SRP

interface GenerateAIBody {
  topic: string;
  amount: number;
  category?: string;
  difficulty?: string;
  type?: string;
  provider?: string;
  language?: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: GenerateAIBody;
  try {
    body = (await request.json()) as GenerateAIBody;
  } catch {
    return NextResponse.json({ message: "JSON inválido" }, { status: 400 });
  }

  // [Idioma objetivo validado]: solo códigos soportados; si no, idioma por defecto | [Patrón]: Input Sanitization
  const payload = {
    ...body,
    language: isLanguage(body.language) ? body.language : DEFAULT_LANGUAGE,
  };
  // [Token fresco]: la generación IA tarda 60-120s; el usuario puede haber dejado el form abierto > TTL (15m). Refresca proactivamente para evitar 401 | [Patrón]: Token Refresh
  const bearer = (await getFreshAccessToken()) ?? undefined;

  try {
    const data = await apiFetch<unknown>("/quiz/ai/generate", {
      method: "POST",
      body: payload,
      bearer,
    });
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message =
      err instanceof ApiError ? err.message : "Error generando preguntas AI";
    return NextResponse.json({ message }, { status });
  }
}
