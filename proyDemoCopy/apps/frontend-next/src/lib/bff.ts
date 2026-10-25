import { NextResponse } from "next/server";
import { getFreshAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
// [Helper BFF]: plantilla común de Route Handlers mutadores (parseo JSON, refresco de token, traducción de errores) | [Patrón]: Template Method funcional + Proxy (BFF) | [Principio]: DRY + SRP | [Paradigma]: Funcional (función de orden superior) + async/await
// [Tecnología]: Next.js Route Handlers (NextResponse)

// `export async function`: recibe la acción concreta como callback → cada ruta solo define QUÉ hace, no CÓMO manejar errores
export async function bffMutation(
  request: Request, // Request estándar de la Web Fetch API
  action: (body: unknown) => Promise<unknown>, // Función de orden superior: la operación contra el backend
  successStatus = 200, // Parámetro con valor por defecto (ES2015)
): Promise<NextResponse> {
  let body: unknown; // `unknown` (TS): se reenvía sin asumir su forma; el backend valida
  try {
    body = await request.json(); // Parseo del JSON del navegador
  } catch {
    // `catch` sin variable (ES2019): JSON mal formado → 400 sin llamar al backend (ahorra una petición)
    return NextResponse.json({ message: "JSON inválido" }, { status: 400 });
  }
  try {
    await getFreshAccessToken(); // [Token Refresh]: formularios abiertos más allá del TTL no fallan con 401
    return respond(await action(body), successStatus);
  } catch (err) {
    // [Traducción de errores]: conserva status y mensaje del backend; nunca expone trazas internas
    const status = err instanceof ApiError ? err.status : 500;
    const message = err instanceof ApiError ? err.message : "Error inesperado";
    return NextResponse.json({ message }, { status });
  }
}

// [Helper BFF sin cuerpo]: lecturas y mutaciones sin JSON de entrada (DELETE, activar, iniciar sesión de quiz…) | [2026-10-23]: también refresca el token → antes «Unauthorized» al crear/editar usuarios con el access vencido
export async function bffQuery(action: () => Promise<unknown>, successStatus = 200): Promise<NextResponse> {
  try {
    await getFreshAccessToken(); // [Token Refresh]: mismo criterio que bffMutation | [Principio]: DRY
    return respond(await action(), successStatus);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    const message = err instanceof ApiError ? err.message : "Error inesperado";
    return NextResponse.json({ message }, { status });
  }
}

// [respond]: 204 No Content no admite cuerpo (NextResponse.json lanzaría) | [Paradigma]: Funcional (pura)
function respond(data: unknown, status: number): NextResponse {
  return status === 204 ? new NextResponse(null, { status }) : NextResponse.json(data, { status });
}
