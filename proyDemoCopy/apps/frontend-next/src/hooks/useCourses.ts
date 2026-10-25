"use client"; // [Next.js]: hook de cliente (estado + transiciones de React)
import { useCallback, useState, useTransition } from "react";
import { postReaction } from "@/store/api/coursesApi"; // [DIP]: la red va por el Facade del módulo
import type { ReactionKind } from "@/types/courses";
// [useCourses · 2026-10-23 · 4.º pase]: hooks del módulo Cursos — `useCourseReactions` = barra ★ 👍 ❤ con actualización OPTIMISTA (antes inline en CourseActions)
// [Patrón]: Custom Hook + Optimistic Update + Rollback | [Principio]: SRP (CourseActions solo pinta) + DRY | [Paradigma]: Funcional (actualizaciones inmutables) + Reactivo

// `export type` (TS): las tres reacciones como banderas
export type ReactionState = Readonly<Record<ReactionKind, boolean>>;

export function useCourseReactions(courseId: string, initial: ReactionState) {
  const [state, setState] = useState<ReactionState>(initial); // Hidratado por el servidor → sin parpadeo SSR/CSR
  const [pending, setPending] = useState<ReactionKind | null>(null); // Reacción en vuelo (deshabilita su botón)
  const [, startTransition] = useTransition(); // [React 19]: la petición no bloquea la UI

  // `useCallback` (React): referencia estable para los botones | flip = invierte una bandera sin mutar el objeto (spread)
  const toggle = useCallback(
    (kind: ReactionKind) => {
      const flip = (prev: ReactionState) => ({ ...prev, [kind]: !prev[kind] });
      setState(flip); // [Optimistic UI]: cambia antes de la red
      setPending(kind);
      startTransition(async () => {
        try {
          await postReaction(courseId, kind);
        } catch {
          setState(flip); // [Rollback]: la red falló → se deshace
        } finally {
          setPending(null);
        }
      });
    },
    [courseId],
  );

  return { state, pending, toggle };
}
