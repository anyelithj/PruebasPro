import { NextRequest, NextResponse } from "next/server";
import { apiFetch } from "@/lib/api-client";
import { getCurrentAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import type { MyHistoryItem } from "@/types/quiz";
// [Route Handler /api/quiz/sessions/me]: BFF proxy del historial académico | [Patrón]: Proxy | [Principio]: SRP

export async function GET(req: NextRequest): Promise<NextResponse> {
  const bearer = (await getCurrentAccessToken()) ?? undefined;
  const limit = req.nextUrl.searchParams.get("limit") ?? "20";
  try {
    const data = await apiFetch<MyHistoryItem[]>(
      `/quiz/sessions/me?limit=${encodeURIComponent(limit)}`,
      { bearer },
    );
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message =
      err instanceof ApiError ? err.message : "Error cargando historial";
    return NextResponse.json({ message }, { status });
  }
}
