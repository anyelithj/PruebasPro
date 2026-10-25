import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api-client";
import { getCurrentAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
// [Route Handler /api/auth/me]: lee perfil del usuario actual desde backend con Bearer cookie | [Patrón]: Facade | [Principio]: SRP | [Paradigma]: Funcional + asíncrono

// [GET]: usado por client para hidratar Redux tras refresh de página
export async function GET(): Promise<NextResponse> {
  const token = await getCurrentAccessToken();
  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  try {
    // [Fix]: el perfil propio vive en NestJS GET /profile/me (/users/me no existe y respondía 400 «uuid is expected») | lo consume la sesión del remoto Angular
    const user = await apiFetch<unknown>("/profile/me", {
      method: "GET",
      bearer: token,
    });
    return NextResponse.json({ user });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json({ user: null, message: "no-profile" }, { status });
  }
}
