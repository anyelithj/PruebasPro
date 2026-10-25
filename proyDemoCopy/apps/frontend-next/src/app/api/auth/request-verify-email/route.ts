import { NextResponse } from "next/server";
import { z } from "zod";
import { apiFetch } from "@/lib/api-client";
import { ApiError } from "@/lib/errors";

const schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Email inválido" }, { status: 400 });
  }
  try {
    await apiFetch<{ success: true }>("/auth/request-verify-email", {
      method: "POST",
      body: { email: parsed.data.email },
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return NextResponse.json(
        {
          message: "Verificación de email pendiente en backend",
        },
        { status: 501 },
      );
    }
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 },
    );
  }
  return NextResponse.json({ success: true });
}
