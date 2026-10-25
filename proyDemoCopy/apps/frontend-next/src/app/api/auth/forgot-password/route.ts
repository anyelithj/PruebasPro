import { NextResponse } from "next/server";
import { z } from "zod";
import { apiFetch } from "@/lib/api-client";
import { ApiError } from "@/lib/errors";
// [Route forgot-password]: proxy → NestJS POST /auth/forgot-password (genera token + envía correo) | [Patrón]: Adapter + BFF | [Principio]: SRP
// [Seguridad]: el backend responde 200 exista o no el correo → no se filtra información de cuentas

// [Validación en el borde]: Zod rechaza entradas mal formadas antes de llegar al backend | [Principio]: Fail fast
const schema = z.object({ email: z.string().trim().email().max(320) });

// `export async function POST` (Next.js App Router): handler del método HTTP POST
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})); // `.catch`: cuerpo no-JSON → objeto vacío (falla la validación)
  const parsed = schema.safeParse(body); // `safeParse` (Zod): no lanza, devuelve { success, data | error }
  if (!parsed.success) {
    return NextResponse.json({ message: "Email inválido" }, { status: 400 });
  }
  try {
    await apiFetch<{ success: true }>("/auth/forgot-password", {
      method: "POST",
      body: { email: parsed.data.email },
    });
  } catch (err) {
    // [Propaga el estado del backend]: p. ej. 429 (@Throttle) para que la UI muestre "demasiados intentos"
    if (err instanceof ApiError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 },
    );
  }
  return NextResponse.json({ success: true });
}
