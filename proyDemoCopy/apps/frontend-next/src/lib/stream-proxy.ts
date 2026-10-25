import { getFreshAccessToken } from "./auth";
import { apiUrl } from "./constants";
// [Proxy de streaming BFF]: reenvía cuerpo y respuesta SIN cargarlos en memoria (subidas de video de cientos de MB, reproducción con Range) | [Patrón]: Proxy (BFF) | [Principio]: SRP + DRY | [Paradigma]: Funcional
// [Tecnología]: Web Streams (ReadableStream) + fetch de Node 18+ (`duplex: "half"` es obligatorio para enviar un body en streaming)
// [Seguridad]: el JWT sale de la cookie httpOnly en el servidor; solo se reenvían cabeceras de una lista blanca

// [Cabeceras que viajan al backend y de vuelta]: `as const` (TS) | Range/Content-Range permiten adelantar el video | `last-event-id` + `accept`: reconexión SSE (Sprint 6.2) | `cache-control`: el flujo SSE no se cachea
const REQUEST_HEADERS = ["content-type", "content-length", "range", "accept", "last-event-id", "x-forwarded-for"] as const; // [2026-10-23]: x-forwarded-for → rate limit por usuario real, no por la IP del servidor Next
// `location` (Sprint 6.7): 302 del backend hacia la URL firmada de S3/R2 → el navegador descarga directo del bucket
const RESPONSE_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges", "content-disposition", "x-content-type-options", "cache-control", "location"] as const;

// `RequestInit & { duplex }` (TS): `duplex` aún no está en los tipos del DOM
type StreamingInit = RequestInit & { duplex?: "half" };

// [streamToBackend]: método + ruta del backend; devuelve la Response del backend tal cual (status incluido)
export async function streamToBackend(request: Request, path: string, method: string = request.method): Promise<Response> {
  const token = await getFreshAccessToken(); // Renueva si el access token caducó (subidas largas)
  const headers = new Headers();
  for (const h of REQUEST_HEADERS) {
    const v = request.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (token) headers.set("authorization", `Bearer ${token}`);

  const hasBody = method !== "GET" && method !== "HEAD" && method !== "DELETE";
  // `redirect: "manual"` (fetch): la 302 a la URL firmada llega al navegador; si Next la siguiera, los bytes del video volverían a pasar por aquí
  const init: StreamingInit = { method, headers, body: hasBody ? request.body : undefined, duplex: hasBody ? "half" : undefined, redirect: "manual" };
  const upstream = await fetch(apiUrl(path), init);

  const out = new Headers();
  for (const h of RESPONSE_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) out.set(h, v);
  }
  // `upstream.body` (ReadableStream): se canaliza al navegador sin buffer intermedio
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
