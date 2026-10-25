import { NextResponse } from "next/server";
import { z } from "zod";
import { register } from "@/lib/auth";
import { ApiError } from "@/lib/errors";

// [Schema server-side]: el cliente ya validó confirmPassword + acceptTerms. Aquí solo lo que se envía a NestJS | [Principio]: SSOT pragmático
const serverRegisterSchema = z.object({
  firstName: z.string().trim().min(1, "Nombre obligatorio").max(80),
  lastName: z.string().trim().min(1, "Apellido obligatorio").max(80),
  email: z.string().trim().email("Email inválido"),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .max(128)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, "Debe incluir mayúscula, minúscula y dígito"),
});
// [Route Handler /api/auth/register]: BFF para crear cuenta | [Patrón]: Adapter + Facade | [Principio]: SRP | [Paradigma]: Funcional + asíncrono

export async function POST(request: Request): Promise<NextResponse> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Cuerpo de la petición inválido" },
      { status: 400 },
    );
  }

  // [Validación]: defensa en profundidad — schema minimal sin confirmPassword/acceptTerms
  const parsed = serverRegisterSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }

  try {
    const data = await register({
      email: parsed.data.email,
      password: parsed.data.password,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
    });
    return NextResponse.json({ user: data.user }, { status: 201 });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message =
      err instanceof ApiError ? err.message : "Error inesperado del servidor";
    return NextResponse.json({ message }, { status });
  }
}
