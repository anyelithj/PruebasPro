import { NextResponse } from "next/server";
import { z } from "zod";
import { apiFetch } from "@/lib/api-client";

const schema = z.object({ token: z.string().min(16, "Token inválido") });

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Token de verificación inválido" },
      { status: 400 },
    );
  }
  try {
    await apiFetch<{ verified: true }>("/auth/verify-email", {
      method: "POST",
      body: { token: parsed.data.token },
    });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Error al verificar email" },
      { status: 400 },
    );
  }
  return NextResponse.json({ verified: true });
}
