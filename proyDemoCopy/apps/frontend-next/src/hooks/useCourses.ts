"use client"; // [Next.js]: hook de cliente (estado + transiciones de React)
import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AuthRequiredError, saveFavorite, saveReaction } from "@/store/api/coursesApi"; // [DIP]: la red va por el Facade del módulo
import type { CourseEngagement, ReactionType } from "@/types/courses"; // `import type` (TS): solo tipos
// [useCourseEngagement · Caso F · 2026-11-13]: ⭐ favorito y 👍/❤️ reacción con actualización OPTIMISTA, reversión si falla y paso al login sin sesión
// Sustituye a useCourseReactions (tres banderas sueltas que permitían 👍 y ❤️ a la vez y no mostraban conteos)
// [Patrón]: Custom Hook + Optimistic Update + Rollback | [Principio]: SRP (la barra solo pinta) + DRY (un hook para card y detalle) | [Paradigma]: Funcional (reductores puros) + Reactivo

// ───── Reductores puros (exportados para pruebas) | [Paradigma]: Funcional — devuelven un objeto NUEVO, nunca mutan ─────
export const withFavorite = (s: CourseEngagement, on: boolean): CourseEngagement => ({ ...s, isFavorite: on }); // `...` (ES2018 object spread)

// [withReaction]: aplica la reacción `next` (null = quitar) y ajusta los conteos públicos: resta la anterior y suma la nueva
export function withReaction(s: CourseEngagement, next: ReactionType | null): CourseEngagement {
  const delta = (t: ReactionType) => (next === t ? 1 : 0) - (s.reaction === t ? 1 : 0); // +1 entra · −1 sale · 0 sin cambio
  return { ...s, reaction: next, likesCount: Math.max(0, s.likesCount + delta("like")), lovesCount: Math.max(0, s.lovesCount + delta("love")) };
}

// [nextReaction]: pulsar la activa la quita; pulsar la otra la reemplaza (like y love excluyentes)
export const nextReaction = (current: ReactionType | null, pressed: ReactionType): ReactionType | null => (current === pressed ? null : pressed);

export type EngagementAction = "favorite" | ReactionType; // Botón en vuelo (deshabilita solo ese)

// [loginUrlFor]: inicio de sesión con regreso a ESTA card (`#course-…` = ancla en el catálogo) | Función pura (recibe la ruta actual)
export const loginUrlFor = (courseId: string, current: string): string => `/login?from=${encodeURIComponent(`${current}#course-${courseId}`)}`;

// `onAuthRequired?` (TS opcional): inyectable en pruebas; por defecto `router.push` (next/navigation) | [Patrón]: Dependency Injection por parámetro
export function useCourseEngagement(courseId: string, initial: CourseEngagement, onAuthRequired?: (courseId: string) => void) {
  const router = useRouter(); // `useRouter` (Next.js App Router): navegación de cliente sin recargar
  const [state, setState] = useState<CourseEngagement>(initial); // Hidratado por el servidor → sin parpadeo SSR/CSR y correcto al recargar
  const [pending, setPending] = useState<EngagementAction | null>(null);
  const [, startTransition] = useTransition(); // [React 19]: la petición no bloquea la UI

  // [run]: plantilla común de las dos acciones | [Patrón]: Template Method funcional | optimista → red → estado real del servidor | error → reversión
  const run = useCallback(
    (action: EngagementAction, optimistic: CourseEngagement, request: () => Promise<CourseEngagement>) => {
      const previous = state; // Instantánea para revertir
      setState(optimistic);
      setPending(action);
      startTransition(async () => {
        try {
          setState(await request()); // El servidor es la fuente de verdad (conteos de otros usuarios incluidos)
          // [Fix 2026-11-16]: refresca los datos del servidor (RSC) → «Mis favoritos» quita la card desmarcada y el catálogo/detalle no muestran un estado viejo al volver
          router.refresh();
        } catch (err) {
          setState(previous); // [Rollback]
          // [Sin sesión]: login y regreso a la card | `??` (ES2020): sin manejador inyectado → router.push
          if (err instanceof AuthRequiredError) (onAuthRequired ?? ((id: string) => router.push(loginUrlFor(id, `${location.pathname}${location.search}`))))(courseId);
        } finally {
          setPending(null);
        }
      });
    },
    [state, courseId, onAuthRequired, router],
  );

  const toggleFavorite = useCallback(() => {
    const on = !state.isFavorite;
    run("favorite", withFavorite(state, on), () => saveFavorite(courseId, on));
  }, [state, courseId, run]);

  const react = useCallback(
    (pressed: ReactionType) => {
      const next = nextReaction(state.reaction, pressed);
      run(pressed, withReaction(state, next), () => saveReaction(courseId, next));
    },
    [state, courseId, run],
  );

  return { state, pending, toggleFavorite, react };
}
