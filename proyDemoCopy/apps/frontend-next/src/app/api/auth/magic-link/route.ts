import { NextResponse } from "next/server";
import { z } from "zod";
import { apiFetch } from "@/lib/api-client";
import { setAuthCookies, type AuthResponse } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
// [Route Handler /api/auth/magic-link · Sprints 1.5/7.18]: BFF del acceso sin contraseña | [Patrón]: Adapter + Facade (mismo flujo de cookies httpOnly que /api/auth/login) | [Principio]: SRP + DRY (setAuthCookies) | [Paradigma]: Funcional + asíncrono
// POST { email } → NestJS envía el enlace (respuesta siempre genérica) · GET ?token= → el enlace del correo aterriza aquí, se canjea y se redirige al panel
// [Seguridad]: el token nunca llega a JavaScript del navegador (se canjea en el servidor) y la sesión queda en cookies httpOnly

const RequestSchema = z.object({ email: z.email() }); // `z.email()` (Zod 4)
const TOKEN = /^[0-9a-f]{64}$/;

export async function POST(request: Request): Promise<NextResponse> {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Correo inválido" }, { status: 400 });
  try {
    await apiFetch("/auth/magic-link/request", { method: "POST", body: parsed.data });
    return NextResponse.json({ sent: true }, { status: 202 });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json({ message: err instanceof ApiError ? err.message : "Error inesperado del servidor" }, { status });
  }
}

// `NextResponse.redirect` (Next.js): URL absoluta construida sobre la de la petición (mismo origen)
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const fail = NextResponse.redirect(new URL("/login?magic=invalid", url));
  if (!TOKEN.test(token)) return fail;
  try {
    const data = await apiFetch<AuthResponse>("/auth/magic-link/verify", { method: "POST", body: { token } });
    await setAuthCookies(data);
    return NextResponse.redirect(new URL("/dashboard", url));
  } catch {
    return fail; // Usado, caducado o backend caído → el login lo explica
  }
}
