import { NextResponse } from "next/server";
import { login } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { loginSchema } from "@/lib/validations";
// [Route Handler /api/auth/login]: server-side BFF, llama NestJS y setea cookies | [Patrón]: Adapter + Facade | [Principio]: SRP | [Paradigma]: Funcional + asíncrono

// [POST]: recibe { email, password }, devuelve { user } | [Patrón]: Command
export async function POST(request: Request): Promise<NextResponse> {
  // [Parse body]: con tolerancia a JSON malformado
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Cuerpo de la petición inválido" },
      { status: 400 },
    );
  }

  // [Validación Zod]: mismo schema que el form (SSOT)
  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }

  try {
    const data = await login({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    // [Respuesta]: solo perfil al cliente. Tokens viven en cookies httpOnly (no JS)
    return NextResponse.json({ user: data.user });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message =
      err instanceof ApiError ? err.message : "Error inesperado del servidor";
    return NextResponse.json({ message }, { status });
  }
}
