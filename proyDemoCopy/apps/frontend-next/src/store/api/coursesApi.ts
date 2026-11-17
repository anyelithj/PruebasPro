import type { CourseEngagement, ReactionType } from "@/types/courses"; // `import type` (TS): solo tipos, se borra al compilar
// [coursesApi · Caso F · 2026-11-13]: cliente del NAVEGADOR para ⭐ favorito y 👍/❤️ reacción → Route Handlers BFF (/api/courses/:id/…)
// [Patrón]: Facade (oculta fetch, verbos y códigos HTTP) + Gateway | [Principio]: SRP (red aparte de la UI) + DIP (el hook depende de estas funciones, no de fetch)
// [Arquitectura]: el token nunca llega aquí → el BFF lo añade desde la cookie httpOnly | lecturas SSR = lib/courses-api.ts

// [AuthRequiredError]: 401 → el visitante no tiene sesión; la UI lo lleva al inicio de sesión | `class … extends Error` (ES2015): error tipado con `instanceof`
export class AuthRequiredError extends Error {
  constructor() {
    super("Inicia sesión para guardar o valorar cursos");
    this.name = "AuthRequiredError";
  }
}

// [send]: un único punto de red (DRY) | `async` (ES2017) | devuelve el estado REAL del servidor (fuente de verdad tras la actualización optimista)
async function send(courseId: string, resource: "favorite" | "reaction", method: "PUT" | "DELETE", body?: unknown): Promise<CourseEngagement> {
  const res = await fetch(`/api/courses/${encodeURIComponent(courseId)}/${resource}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined, // `?:` (JS): sin cuerpo no se declara JSON
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) throw new AuthRequiredError();
  if (!res.ok) throw new Error(`${resource} ${method} falló (${res.status})`); // El hook revierte el cambio optimista
  // [Fix 2026-11-14]: NestJS envuelve en { statusCode, data, meta } (TransformInterceptor) → antes se guardaba el sobre como estado y ⭐ 👍 ❤️ se apagaban tras el clic
  const json = (await res.json()) as { data?: CourseEngagement } & Partial<CourseEngagement>;
  return (json.data ?? json) as CourseEngagement; // `as` (TS): contrato CourseEngagementDto de NestJS
}

// [Comandos idempotentes]: PUT marca · DELETE quita (repetir no cambia nada)
export const saveFavorite = (courseId: string, on: boolean) => send(courseId, "favorite", on ? "PUT" : "DELETE");
export const saveReaction = (courseId: string, type: ReactionType | null) =>
  type ? send(courseId, "reaction", "PUT", { type }) : send(courseId, "reaction", "DELETE");
