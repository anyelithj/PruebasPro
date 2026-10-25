import { NextResponse } from "next/server";
import { logout } from "@/lib/auth";
// [Route Handler /api/auth/logout]: revoca refresh + limpia cookies | [Patrón]: Command | [Principio]: SRP | [Paradigma]: Funcional + asíncrono

// [POST]: idempotente — siempre 200 aunque no haya sesión
export async function POST(): Promise<NextResponse> {
  await logout();
  return NextResponse.json({ success: true });
}
