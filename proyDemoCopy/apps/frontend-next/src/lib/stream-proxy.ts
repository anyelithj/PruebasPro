import { getFreshAccessToken } from "./auth";
import { apiUrl } from "./constants";
// [Proxy de streaming BFF]: reenvía cuerpo y respuesta SIN cargarlos en memoria (subidas de video de cientos de MB, reproducción con Range) | [Patrón]: Proxy (BFF) | [Principio]: SRP + DRY | [Paradigma]: Funcional
// [Tecnología]: Web Streams (ReadableStream) + fetch de Node 18+ (`duplex: "half"` es obligatorio para enviar un body en streaming)
// [Seguridad]: el JWT sale de la cookie httpOnly en el servidor; solo se reenvían cabeceras de una lista blanca
// [2026-10-24 · Resiliencia]: los cuerpos JSON/texto pequeños se leen a memoria (se pueden REENVIAR) → un `ECONNRESET` de un socket keep-alive caducado se reintenta una vez; las subidas grandes siguen en streaming (no se pueden repetir) | [Patrón]: Retry (una vez) + Buffer pequeño / Stream grande | [Principio]: Fail Safe (502 JSON en vez de excepción)

// [Cabeceras que viajan al backend y de vuelta]: `as const` (TS) | Range/Content-Range permiten adelantar el video | `last-event-id` + `accept`: reconexión SSE (Sprint 6.2) | `cache-control`: el flujo SSE no se cachea
const REQUEST_HEADERS = ["content-type", "content-length", "range", "accept", "last-event-id", "x-forwarded-for"] as const; // [2026-10-23]: x-forwarded-for → rate limit por usuario real, no por la IP del servidor Next
// `location` (Sprint 6.7): 302 del backend hacia la URL firmada de S3/R2 → el navegador descarga directo del bucket
const RESPONSE_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges", "content-disposition", "x-content-type-options", "cache-control", "location"] as const;

// [Cuerpos reenviables]: JSON, texto y formularios urlencoded ≤ 1 MB → se leen a memoria y se pueden mandar dos veces | `RegExp` (JS): tipo MIME sin parámetros (`; charset=utf-8`)
const REPLAYABLE_TYPE = /^(application\/(json|[\w.+-]+\+json|x-www-form-urlencoded)|text\/)/i;
const MAX_BUFFERED_BYTES = 1024 * 1024; // Tope del buffer en memoria (constante nombrada, sin número mágico)
// [Errores de transporte reintentables]: socket cerrado por el otro lado antes de responder (keep-alive caducado en NestJS) | códigos de Node/undici
const RETRYABLE_CODES = new Set(["ECONNRESET", "EPIPE", "ECONNREFUSED", "UND_ERR_SOCKET", "UND_ERR_CLOSED", "ETIMEDOUT"]);
const RETRY_DELAY_MS = 150; // Pausa breve: deja a NestJS terminar de cerrar el socket viejo antes del reintento

// `RequestInit & { duplex }` (TS): `duplex` aún no está en los tipos del DOM
type StreamingInit = RequestInit & { duplex?: "half" };

// [isRetryableNetworkError]: `fetch failed` de undici trae el código real en `cause` (a veces anidado: cause.cause) | función pura exportada para pruebas
export function isRetryableNetworkError(err: unknown): boolean {
  // `for` con profundidad acotada: recorre la cadena de causas sin riesgo de bucle infinito
  let current: unknown = err;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
    const { code, name } = current as { code?: string; name?: string };
    if (name === "AbortError") return false; // El navegador canceló: no se reintenta
    if (code && RETRYABLE_CODES.has(code)) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

// [readBody]: decide entre buffer (reenviable) o stream (subida grande) | `ArrayBuffer` = bytes completos en memoria
async function readBody(request: Request, hasBody: boolean): Promise<{ body: BodyInit | null; replayable: boolean }> {
  if (!hasBody || !request.body) return { body: null, replayable: true }; // Sin cuerpo: siempre se puede repetir
  const type = request.headers.get("content-type") ?? "";
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (REPLAYABLE_TYPE.test(type) && declared <= MAX_BUFFERED_BYTES) {
    return { body: await request.arrayBuffer(), replayable: true }; // `arrayBuffer()` (Fetch API): lee todo el cuerpo una sola vez
  }
  return { body: request.body, replayable: false }; // multipart/audio/video: streaming, sin reintento posible
}

// [badGateway]: respuesta JSON uniforme cuando NestJS no responde (el cliente muestra `message`)
const badGateway = (message: string): Response => Response.json({ message }, { status: 502 });

// `setTimeout` envuelto en Promise: espera no bloqueante
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// [streamToBackend]: método + ruta del backend; devuelve la Response del backend tal cual (status incluido) o 502 JSON si el backend no responde
export async function streamToBackend(request: Request, path: string, method: string = request.method): Promise<Response> {
  const token = await getFreshAccessToken(); // Renueva si el access token caducó (subidas largas)
  const headers = new Headers();
  for (const h of REQUEST_HEADERS) {
    const v = request.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (token) headers.set("authorization", `Bearer ${token}`);

  const hasBody = method !== "GET" && method !== "HEAD" && method !== "DELETE";
  let payload: Awaited<ReturnType<typeof readBody>>; // `Awaited<ReturnType<…>>` (TS): tipo inferido sin duplicarlo
  try {
    payload = await readBody(request, hasBody);
  } catch {
    // [Cuerpo del navegador abortado]: la conexión entrante se cortó mientras se leía → no hay nada que reenviar
    return badGateway("La petición se interrumpió antes de llegar al servidor. Inténtalo de nuevo.");
  }
  if (payload.body instanceof ArrayBuffer) headers.delete("content-length"); // fetch calcula la longitud real del buffer (evita desajustes con la cabecera original)

  // `redirect: "manual"` (fetch): la 302 a la URL firmada llega al navegador; si Next la siguiera, los bytes del video volverían a pasar por aquí
  const streaming = payload.body !== null && !payload.replayable;
  const init: StreamingInit = { method, headers, body: payload.body ?? undefined, duplex: streaming ? "half" : undefined, redirect: "manual" };
  // [Intentos]: 2 si el cuerpo es reenviable, 1 si va en streaming (un stream consumido no se puede volver a leer)
  const attempts = payload.replayable ? 2 : 1;

  let upstream: Response | undefined;
  for (let attempt = 1; attempt <= attempts && !upstream; attempt++) {
    try {
      upstream = await fetch(apiUrl(path), init);
    } catch (err) {
      const retry = attempt < attempts && isRetryableNetworkError(err);
      console.warn(`[bff] ${method} ${path} falló (intento ${attempt}/${attempts}${retry ? ", se reintenta" : ""}):`, (err as Error).message);
      if (!retry) return badGateway("No se pudo contactar con el servidor. Inténtalo de nuevo en unos segundos.");
      await delay(RETRY_DELAY_MS);
    }
  }
  if (!upstream) return badGateway("No se pudo contactar con el servidor."); // Rama defensiva: el bucle siempre asigna o retorna

  const out = new Headers();
  for (const h of RESPONSE_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) out.set(h, v);
  }
  // `upstream.body` (ReadableStream): se canaliza al navegador sin buffer intermedio
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
