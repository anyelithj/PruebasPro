import { streamToBackend } from "@/lib/stream-proxy"; // [BFF]: proxy con el JWT de la cookie httpOnly
// [Route Handler /api/courses/:courseId/favorite · Caso F · 2026-11-13]: PUT (guardar en «Mis favoritos») · DELETE (quitar) → NestJS, ambos idempotentes
// [Patrón]: Proxy (BFF) | [Principio]: SRP (sin lógica: NestJS autoriza y valida)

type Ctx = { params: Promise<{ courseId: string }> };

const target = async ({ params }: Ctx) => `/courses/${encodeURIComponent((await params).courseId)}/favorite`;

export const PUT = async (request: Request, ctx: Ctx) => streamToBackend(request, await target(ctx));
export const DELETE = async (request: Request, ctx: Ctx) => streamToBackend(request, await target(ctx));
