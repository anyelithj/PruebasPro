import { NextResponse } from "next/server";
import { z } from "zod";
import { apiFetch } from "@/lib/api-client";
import { ApiError } from "@/lib/errors";
// [Route reset-password]: proxy → NestJS POST /auth/reset-password | [Patrón]: Adapter | [Principio]: SRP

const schema = z.object({
  token: z.string().min(16, "Token inválido"),
  newPassword: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .max(128, "Máximo 128 caracteres")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
      "Debe incluir mayúscula, minúscula y dígito",
    ),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Entrada inválida" },
      { status: 400 },
    );
  }
  try {
    await apiFetch<{ success: true }>("/auth/reset-password", {
      method: "POST",
      body: { token: parsed.data.token, newPassword: parsed.data.newPassword },
    });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { message: err.message },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 },
    );
  }
  return NextResponse.json({ success: true });
}
