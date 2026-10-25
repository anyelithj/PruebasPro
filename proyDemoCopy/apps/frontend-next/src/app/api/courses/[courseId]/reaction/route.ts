import { NextResponse } from "next/server";
import { toggleReaction } from "@/lib/courses-api";
import { ApiError } from "@/lib/errors";
import { getFreshAccessToken } from "@/lib/auth"; // [2026-10-23]: refresca el access token vencido
import type { ReactionKind } from "@/types/courses";
// [Route Handler /api/courses/:courseId/reaction POST]: BFF proxy a NestJS POST /courses/:id/reaction | [Patrón]: Proxy + Facade | [Principio]: SRP

const ALLOWED: ReactionKind[] = ["like", "love", "favorite"];

interface Params {
  params: Promise<{ courseId: string }>;
}

export async function POST(request: Request, ctx: Params): Promise<NextResponse> {
  const { courseId } = await ctx.params;
  let body: { kind?: ReactionKind };
  try {
    body = (await request.json()) as { kind?: ReactionKind };
  } catch {
    return NextResponse.json({ message: "JSON inválido" }, { status: 400 });
  }

  if (!body.kind || !ALLOWED.includes(body.kind)) {
    return NextResponse.json(
      { message: "kind debe ser like | love | favorite" },
      { status: 400 },
    );
  }

  try {
    await getFreshAccessToken();
    const result = await toggleReaction(courseId, body.kind);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message =
      err instanceof ApiError ? err.message : "Error alternando reacción";
    return NextResponse.json({ message }, { status });
  }
}
