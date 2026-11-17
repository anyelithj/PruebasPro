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
  // [Fix 2026-10-28 · timeouts]: `?` (TS) opcionales → los llamadores existentes no cambian | [Principio]: OCP + compatibilidad hacia atrás
  timeoutMs?: number; // Corta la espera con `AbortSignal.timeout` (Web API) ANTES del `headersTimeout` de 300 s de undici (fetch de Node) → 504 claro en vez de 503 a los 5 min
  timeoutMessage?: string; // Texto para el usuario si se agota (p. ej. «La IA tardó demasiado…»)
}

// [Timeout por defecto]: mensaje genérico (no sabemos qué operación era) | `const` en mayúsculas: constante de módulo
const DEFAULT_TIMEOUT_MESSAGE = "El servidor tardó demasiado en responder. Inténtalo de nuevo en unos minutos.";

// [isTimeout · Fix 2026-10-28]: ¿el fallo de `fetch` fue por tiempo? → `TimeoutError`/`AbortError` (AbortSignal) o `UND_ERR_HEADERS_TIMEOUT`/`UND_ERR_BODY_TIMEOUT` (undici, en `err.cause`)
// [Paradigma]: Funcional (pura) | `?.` (ES2020): `cause` puede no existir
function isTimeout(err: unknown): boolean {
  const e = err as { name?: string; cause?: { code?: string; name?: string } } | null;
  return e?.name === "TimeoutError" || e?.name === "AbortError" || /UND_ERR_(HEADERS|BODY)_TIMEOUT/.test(e?.cause?.code ?? "") || e?.cause?.name === "HeadersTimeoutError";
}

// [Helper genérico]: parsea envelope { statusCode, data, meta } | [Principio]: SRP
export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { body, bearer, headers, timeoutMs, timeoutMessage, ...rest } = options;

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
    // [Fix 2026-10-28]: `AbortSignal.any` (Web API, Node 20+) combina la señal del llamador (si la hay) con el timeout → cualquiera de las dos aborta
    const signals = [rest.signal, timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined].filter((x): x is AbortSignal => Boolean(x));
    response = await fetch(apiUrl(path), {
      ...rest,
      headers: composedHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...(signals.length ? { signal: signals.length > 1 ? AbortSignal.any(signals) : signals[0] } : {}),
    });
  } catch (err) {
    // [Fix 2026-10-28]: tiempo agotado → 504 Gateway Timeout con mensaje accionable (antes 503 «El servidor no responde» tras 5,2 min de undici)
    if (isTimeout(err)) {
      console.error(`[apiFetch] ${path}: tiempo de espera agotado${timeoutMs ? ` (${timeoutMs} ms)` : ""}`);
      throw new ApiError(504, timeoutMessage ?? DEFAULT_TIMEOUT_MESSAGE);
    }
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
