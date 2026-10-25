import type { ReactionKind } from "@/types/courses"; // `import type` (TS): solo tipos, se borra al compilar
// [coursesApi · 2026-10-23 · 4.º pase]: cliente del NAVEGADOR para los Route Handlers BFF de Cursos (/api/courses/*) — antes `postReaction` vivía dentro de CourseActions
// [Patrón]: Facade (oculta fetch, cabeceras y códigos HTTP) + Gateway | [Principio]: SRP (red aparte de la UI) + DIP (los componentes dependen de estas funciones, no de fetch)
// [Arquitectura]: el token nunca llega aquí → el BFF de Next.js lo añade desde la cookie httpOnly | lecturas SSR = lib/courses-api.ts (Server Components)
// ponytail: funciones sueltas, no RTK Query — el catálogo se lee en el servidor (RSC) y solo las reacciones se escriben desde el cliente

// [postReaction]: POST /api/courses/:id/reaction { kind } → alterna favorito / me gusta / me encanta | `async` (ES2017) | lanza Error si el BFF responde ≠ 2xx
export async function postReaction(courseId: string, kind: ReactionKind): Promise<void> {
  const res = await fetch(`/api/courses/${encodeURIComponent(courseId)}/reaction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind }),
  });
  if (!res.ok) throw new Error(`Reaction ${kind} failed (${res.status})`); // El hook revierte el cambio optimista
}
