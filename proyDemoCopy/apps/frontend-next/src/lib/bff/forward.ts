import type { ApiPrefix } from "@aula/api-client"; // [Sprint 7.1]: rutas reales de NestJS (generadas de su OpenAPI)
import { streamToBackend } from "../stream-proxy";
// [forward · Sprint 6.2/6.4]: reenvío único hacia NestJS de los módulos nuevos (cookie httpOnly → Bearer, cuerpo, multipart, Range/206 y SSE) | [Patrón]: Proxy (BFF) + Allowlist | [Principio]: DRY (reutiliza streamToBackend) + OCP (un módulo nuevo = una línea en ROUTES) | [Paradigma]: Funcional
// [Seguridad]: solo se reenvían prefijos declarados → la ruta comodín no expone todo el backend; NestJS sigue validando JWT y rol

// [Lista blanca]: prefijo de /api/* → métodos permitidos | `ReadonlyArray` (TS): inmutable | [SSOT]: aquí se registra cada módulo nuevo
// `prefix: ApiPrefix` (TS): un prefijo que ya no existe en el backend rompe la compilación (contrato generado, no escrito a mano)
// `maxBytes` (opcional): límite del cuerpo comprobado ANTES de reenviar (Content-Length) → una subida enorme no ocupa a NestJS | [Seguridad]: defensa en profundidad (NestJS también limita)
const ROUTES: ReadonlyArray<{ prefix: ApiPrefix; methods: readonly string[]; maxBytes?: number }> = [
  { prefix: "notifications", methods: ["GET", "PATCH"] }, // SSE de la campana + /me y marcar leídas (bandeja Angular /notificaciones)
  { prefix: "events", methods: ["GET"] }, // SSE con todos los eventos del usuario (progreso de exportaciones)
  { prefix: "reports/export", methods: ["GET", "POST", "DELETE"] }, // Exportación PDF/Excel (<aula-exportar> y /reportes/exportaciones)
  { prefix: "ai/assistant/chat", methods: ["POST"] }, // Tutor IA: /chat y /chat/stream (Angular /tutor)
  { prefix: "ai/own-llm", methods: ["GET", "POST"] }, // Corrector de redacciones: /writing-corrections y /scope (Angular /redaccion)
  { prefix: "ai/feedback/study-plan", methods: ["POST"] }, // Debilidades + plan de estudio (Angular /estudio/*)
  { prefix: "payments", methods: ["GET", "POST", "PATCH"] }, // [Sprint 7.3/7.4]: órdenes, sesión de Stripe, estado, historial y reembolsos (Angular /checkout y /pagos) · el webhook lo llama Stripe directo al backend
  { prefix: "web3", methods: ["GET", "POST", "PATCH", "DELETE"] }, // [Sprint 7.6/7.7]: billetera SIWE y pago con ETH de prueba (Angular /wallet y /checkout/cripto)
  { prefix: "certificates", methods: ["GET", "POST", "PATCH"] },
  { prefix: "forums", methods: ["GET", "POST", "PATCH", "DELETE"] }, // [Sprint 7.14]: hilos por lección, respuestas y moderación (Angular /foros)
  { prefix: "vocabulary", methods: ["GET", "POST", "PATCH", "DELETE"] }, // [Sprints 8.2/8.3/8.4]: traducción + IPA UK/US (caché), banco de vocabulario (Angular /traductor y /vocabulario, <aula-ipa-text>, editor de recursos)
  { prefix: "games", methods: ["GET", "POST", "PATCH", "DELETE"] }, // [Sprints 8.5/8.8–8.11]: partidas, rondas, turno del agente, mazo SM-2, escenarios y fluidez (Angular /juegos)
  { prefix: "speech", methods: ["POST"], maxBytes: 25 * 1024 * 1024 }, // [Sprints 8.6/8.9]: transcripción (multipart, máx. 25 MB = MAX_AUDIO_BYTES de NestJS · 2026-10-23) y métricas de fluidez
  // [Sprints 9.2/9.3/9.14]: canciones, letras, colecciones y prácticas; diálogos, turnos y conversación con el avatar (SSE) · audio con Range/206 y subida ≤ 20 MB (= MAX_SONG_AUDIO_BYTES de NestJS)
  { prefix: "music", methods: ["GET", "POST", "PATCH", "DELETE"], maxBytes: 20 * 1024 * 1024 },
  { prefix: "dialogues", methods: ["GET", "POST", "PATCH", "DELETE"], maxBytes: 20 * 1024 * 1024 },
  // [Sprints 10.2/10.5/10.9/10.13]: diccionario (/vocabulary/words ya entra por «vocabulary»), poliglota y gramática (Angular /poliglota, /gramatica y <aula-word-lookup>)
  { prefix: "polyglot", methods: ["GET", "POST", "PATCH", "DELETE"] },
  { prefix: "grammar", methods: ["GET", "POST", "PATCH", "DELETE"] },
  { prefix: "practice", methods: ["GET", "POST", "PATCH", "DELETE"] }, // [Sprints 8.12/8.14/8.15]: actividades, ítems, intentos con corrección y borrador de IA (Angular /practica)
  { prefix: "help", methods: ["GET", "POST", "PATCH", "DELETE"] }, // [Sprints 7.10/7.11]: FAQ (pública), manual, Agente Guía (SSE por POST), valoración y borrado de la conversación // [Sprint 7.8]: emitir, listar, PDF (302 a URL firmada) y verificar · /verify es @Public en NestJS (sin cookie no se envía Bearer)
];

// [SEGMENT]: solo letras, dígitos, guion y guion bajo → bloquea `..`, `%2F` y rutas inyectadas | [Principio]: Fail Fast
const SEGMENT = /^[\w-]+$/;

// `export async function forward`: `segments` = partes de la URL capturadas por app/api/[...path]
export async function forward(request: Request, segments: string[]): Promise<Response> {
  const path = segments.join("/");
  const route = ROUTES.find((r) => path === r.prefix || path.startsWith(`${r.prefix}/`));
  if (!segments.every((s) => SEGMENT.test(s)) || !route) return Response.json({ message: "Ruta no encontrada" }, { status: 404 });
  if (!route.methods.includes(request.method)) return Response.json({ message: "Método no permitido" }, { status: 405, headers: { allow: route.methods.join(", ") } });

  // [Límite de subida]: `Content-Length` declarado mayor que el máximo → 413 sin tocar el backend (el navegador siempre lo envía con FormData)
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (route.maxBytes && declared > route.maxBytes) return Response.json({ message: "El archivo supera el tamaño máximo permitido" }, { status: 413 });

  // `URL.search` (WHATWG): conserva el query string (?period=…)
  const upstream = await streamToBackend(request, `/${path}${new URL(request.url).search}`);
  // [SSE]: `no-transform` → ningún middleware de compresión acumula el flujo; `x-accel-buffering: no` → Nginx tampoco
  if (upstream.headers.get("content-type")?.startsWith("text/event-stream")) {
    upstream.headers.set("cache-control", "no-cache, no-transform");
    upstream.headers.set("x-accel-buffering", "no");
  }
  return upstream;
}
