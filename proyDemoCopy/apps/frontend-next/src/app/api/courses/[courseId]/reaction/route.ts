import { streamToBackend } from "@/lib/stream-proxy"; // [BFF]: proxy con el JWT de la cookie httpOnly (el token nunca llega al navegador)
// [Route Handler /api/courses/:courseId/reaction · Caso F · 2026-11-13]: PUT { type: like | love } (reemplaza) · DELETE (quita) → NestJS
// Antes: POST { kind } que alternaba like/love/favorito y validaba a mano → ahora el contrato y la validación viven SOLO en NestJS (DTO) | [Patrón]: Proxy (BFF) | [Principio]: DRY + SSOT

type Ctx = { params: Promise<{ courseId: string }> }; // `Promise<…>` (Next.js 16): los parámetros dinámicos llegan como Promise

// [target]: ruta de NestJS | `encodeURIComponent` (JS): evita inyectar segmentos de ruta
const target = async ({ params }: Ctx) => `/courses/${encodeURIComponent((await params).courseId)}/reaction`;

export const PUT = async (request: Request, ctx: Ctx) => streamToBackend(request, await target(ctx)); // `export const PUT` (Next.js App Router): handler del método
export const DELETE = async (request: Request, ctx: Ctx) => streamToBackend(request, await target(ctx));
