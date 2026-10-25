import { headers as requestHeaders } from "next/headers"; // [Next.js]: cabeceras de la petición entrante (RSC / Route Handler / Server Action)
import { apiUrl } from "./constants";

// [clientIp · 2026-10-23]: IP real del navegador para el rate limit de NestJS — antes TODAS las llamadas del BFF salían con la IP del servidor Next → todos los usuarios compartían un cubo de 100 req/min (ThrottlerException al guardar 120 recursos) | [Patrón]: Header Propagation | `try/catch`: fuera de una petición (scripts, tests) no hay cabeceras
async function clientIp(): Promise<string | undefined> {
  try {
    const h = await requestHeaders();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined;
  } catch {
    return undefined;
  }
}
import { ApiError, type BackendErrorBody } from "./errors";
// [Cliente HTTP universal]: fetch server-side y client-side | [Patrón]: Adapter + Facade | [Principio]: DRY + SSOT | [Paradigma]: Funcional

// [Opciones extendidas]: añadimos auth para inyectar Bearer | [Principio]: ISP
export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  bearer?: string;
}

// [Helper genérico]: parsea envelope { statusCode, data, meta } | [Principio]: SRP
export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { body, bearer, headers, ...rest } = options;

  // [Headers compuestos]: JSON default + Bearer opcional
  const ip = await clientIp();
  const composedHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(ip ? { "X-Forwarded-For": ip } : {}), // [Throttler NestJS]: CustomThrottlerGuard cuenta por esta IP
    ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    ...((headers as Record<string, string>) ?? {}),
  };

  // [Fetch nativo]: no axios para reducir bundle | [Principio]: KISS
  // [Fix 500 en /api/auth/login]: con el backend apagado o reiniciándose `fetch` lanza TypeError («fetch failed») y el Route Handler
  // respondía 500 «Error inesperado» → ahora es ApiError 503 con un mensaje que dice qué pasa | [Principio]: Fail Fast con error tipado
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...rest,
      headers: composedHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    console.error(`[apiFetch] ${path}: backend sin respuesta`, err); // Log de servidor (terminal de Next) para diagnosticar
    throw new ApiError(503, "El servidor no responde. Inténtalo de nuevo en unos segundos.");
  }

  // [Parse JSON tolerante]: backend siempre devuelve JSON, pero defensivo → una página HTML de error (proxy, 502…) no rompe con SyntaxError
  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    throw new ApiError(response.ok ? 502 : response.status, `Respuesta inválida del servidor (HTTP ${response.status})`);
  }

  if (!response.ok) {
    const errBody = parsed as BackendErrorBody | null;
    const msg = errBody?.message
      ? Array.isArray(errBody.message)
        ? errBody.message.join(", ")
        : errBody.message
      : `HTTP ${response.status}`;
    throw new ApiError(response.status, msg, parsed);
  }

  // [Desempaquetado envelope]: { data } → T. Si no hay envelope, devuelve el body completo
  const envelope = parsed as { data?: T } | null;
  return (envelope?.data ?? (parsed as T)) as T;
}
