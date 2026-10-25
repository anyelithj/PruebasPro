import { NextResponse } from "next/server";
import { endSession } from "@/lib/quiz-api";
import { ApiError } from "@/lib/errors";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
): Promise<NextResponse> {
  const { sessionId } = await context.params;
  const url = new URL(request.url);
  const abandon = url.searchParams.get("abandon") === "true";
  try {
    const session = await endSession(sessionId, abandon);
    return NextResponse.json(session);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message =
      err instanceof ApiError ? err.message : "Error inesperado";
    return NextResponse.json({ message }, { status });
  }
}
