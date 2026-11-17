import { NextResponse } from "next/server"; // [Next.js]: respuesta HTTP del Route Handler
import { z } from "zod"; // [Zod]: validación en runtime con inferencia de tipos TS
import { verifyTwoFactor } from "@/lib/auth"; // [Facade]: POST /auth/2fa/verify + cookies httpOnly
import { ApiError } from "@/lib/errors";
// [Route Handler /api/auth/2fa/verify · 2026-11-16]: segundo paso del login con 2FA (código OTP del correo) | [Patrón]: BFF + Adapter | [Principio]: SRP | [Paradigma]: Funcional + asíncrono

// [Esquema]: mismo contrato que el DTO de NestJS (UUID + 6 dígitos) → falla rápido sin viajar al backend | [Principio]: Fail Fast
const schema = z.object({ challengeId: z.uuid(), code: z.string().regex(/^\d{6}$/) });

// `export async function POST` (Next.js App Router): atiende solo POST
export async function POST(request: Request): Promise<NextResponse> {
  // `.catch(() => null)`: JSON malformado → null → lo rechaza Zod
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Código inválido" }, { status: 400 });
  }
  try {
    const data = await verifyTwoFactor(parsed.data.challengeId, parsed.data.code);
    // [Respuesta]: solo el perfil; los tokens ya quedaron en cookies httpOnly
    return NextResponse.json({ user: data.user });
  } catch (err) {
    // [Mensaje del backend]: único para código erróneo/caducado (no filtra detalles) | 429 si se excede el límite
    const status = err instanceof ApiError ? err.status : 500;
    const message = err instanceof ApiError ? err.message : "Error inesperado del servidor";
    return NextResponse.json({ message }, { status });
  }
}
