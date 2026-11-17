import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api-client";
import { renewAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { isRefreshRefused } from "@/lib/token-refresh";
// [Route Handler /api/auth/me]: lee perfil del usuario actual desde backend con Bearer cookie | [Patrón]: Facade | [Principio]: SRP | [Paradigma]: Funcional + asíncrono

// [GET]: usado por client para hidratar Redux tras refresh de página
export async function GET(): Promise<NextResponse> {
  let token: string | null;
  try {
    token = await renewAccessToken();
  } catch (err) {
    // [Fix 2026-10-31]: 401 solo si NestJS rechazó el refresh → antes un backend caído o reiniciándose expulsaba al usuario con la sesión viva (SessionWatcher lleva al login con 401)
    return NextResponse.json({ user: null }, { status: isRefreshRefused(err) ? 401 : 503 });
  }
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
    // [2026-11-16]: sin respuesta de NestJS (reiniciando, caído) → 503 «temporal» en vez de 500 · el cliente reintenta y no lo trata como fallo del servidor
    const status = err instanceof ApiError ? err.status : 503;
    return NextResponse.json({ user: null, message: err instanceof ApiError ? "no-profile" : "backend-unavailable" }, { status });
  }
}
