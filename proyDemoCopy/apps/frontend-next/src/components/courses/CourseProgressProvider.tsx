"use client"; // [Next.js]: Client Component → estado compartido + Server Actions con Optimistic UI
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { completeMaterialAction, completeTopicAction } from "@/lib/purchase-actions";
import { courseProgress, type CourseProgress, type ProgressPart } from "@/lib/course-progress";
// [CourseProgressProvider · 2026-10-28]: UNA sola fuente del avance en la página de la lección → el temario (línea de tiempo) y los recursos se mueven JUNTOS
// Antes cada bloque guardaba su propio `Set` → al estudiar un subtema la barra de los recursos seguía igual hasta recargar | [Patrón]: Context + Provider + Optimistic Update | [Principio]: SSOT + DRY | [Paradigma]: Reactivo
// [Servidor = verdad]: las Server Actions devuelven los ids/títulos guardados en NestJS → se adoptan tal cual (corrige cualquier desfase del optimismo)

interface CourseProgressCtx {
  doneMaterials: ReadonlySet<string>;
  doneTopics: ReadonlySet<string>;
  progress: CourseProgress;
  canTrack: boolean; // true también en vista previa: los botones funcionan
  preview: boolean; // [2026-10-30]: personal sin inscripción → el avance se guarda solo en este navegador
  saving: boolean;
  error: string | null;
  completeMaterial: (id: string, after?: () => void) => void; // `after`: navegar a la siguiente lección cuando el servidor confirma
  setTopicDone: (title: string, done: boolean) => void;
}

// `createContext<T | null>` (React): null = usado fuera del Provider → error explícito en desarrollo
const Ctx = createContext<CourseProgressCtx | null>(null);

export interface CourseProgressProviderProps {
  courseId: string;
  materialIds: string[];
  topicTitles: string[];
  initialMaterials: string[];
  initialTopics: string[];
  lessons?: ProgressPart; // Resumen de la ruta del curso (outline) → misma fórmula que el detalle del curso
  canTrack: boolean;
  preview?: boolean; // [2026-10-30]: ADMIN revisando el curso sin estar inscrito (`?`: por defecto false)
  children: ReactNode;
}

export function CourseProgressProvider({ courseId, materialIds, topicTitles, initialMaterials, initialTopics, lessons, canTrack, preview = false, children }: CourseProgressProviderProps) {
  const router = useRouter();
  const [doneMaterials, setDoneMaterials] = useState<ReadonlySet<string>>(() => new Set(initialMaterials));
  const [doneTopics, setDoneTopics] = useState<ReadonlySet<string>>(() => new Set(initialTopics));
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition(); // `useTransition` (React 18): la Server Action no bloquea la UI

  // [Sincronía con el servidor]: tras `router.refresh()` llegan props nuevas → se adoptan SIN useEffect (patrón «estado derivado de props» de la doc de React)
  const serverKey = `${initialMaterials.join("|")}§${initialTopics.join("|")}`;
  const [seenKey, setSeenKey] = useState(serverKey);
  if (seenKey !== serverKey) {
    setSeenKey(serverKey);
    setDoneMaterials(new Set(initialMaterials));
    setDoneTopics(new Set(initialTopics));
  }

  // [Vista previa · Fix 2026-10-30]: el ADMIN veía los subtemas siempre «Pendiente» y la barra en 0 % porque NestJS solo guarda el progreso de inscritos (inscribirlo falsearía las ventas)
  // → su avance vive en `localStorage` (Web Storage) de este navegador | [Patrón]: Strategy (dónde se guarda) | try/catch: almacenamiento bloqueado → solo en memoria
  const storageKey = `aula:course-preview:${courseId}`;
  useEffect(() => {
    if (!preview) return;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null") as { materials: string[]; topics: string[] } | null;
      if (saved) {
        setDoneMaterials(new Set(saved.materials));
        setDoneTopics(new Set(saved.topics));
      }
    } catch {
      /* Sin almacenamiento: se empieza de cero */
    }
  }, [preview, storageKey]);
  const persist = useCallback(
    (materials: ReadonlySet<string>, topics: ReadonlySet<string>) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ materials: [...materials], topics: [...topics] }));
      } catch {
        /* Sin almacenamiento: dura hasta recargar */
      }
    },
    [storageKey],
  );

  // [Progreso derivado]: `useMemo` (React) → se recalcula solo si cambia el avance o el contenido
  const progress = useMemo(
    () => courseProgress({ materialIds, doneMaterials, topicTitles, doneTopics, lessons }),
    [materialIds, doneMaterials, topicTitles, doneTopics, lessons],
  );

  // [completeMaterial]: Optimistic Update → marca ya, confirma con NestJS y hace rollback si falla | idempotente
  const completeMaterial = useCallback(
    (id: string, after?: () => void) => {
      if (preview) {
        const next = new Set(doneMaterials).add(id);
        setDoneMaterials(next);
        persist(next, doneTopics);
        return after?.();
      }
      if (!canTrack) return;
      const before = doneMaterials;
      if (!before.has(id)) setDoneMaterials(new Set(before).add(id));
      startSaving(async () => {
        const res = await completeMaterialAction(courseId, id);
        if (!res.ok) {
          setError(res.message);
          setDoneMaterials(before); // Rollback
          return;
        }
        setError(null);
        setDoneMaterials(new Set(res.data.completedMaterialIds));
        if (after) after();
        else router.refresh(); // `router.refresh` (Next.js): vuelve a pedir el RSC → el resto de la página ve el progreso guardado
      });
    },
    [canTrack, courseId, doneMaterials, doneTopics, persist, preview, router],
  );

  // [setTopicDone]: marca/desmarca un subtema del temario (mismo patrón optimista)
  const setTopicDone = useCallback(
    (title: string, done: boolean) => {
      if ((!canTrack && !preview) || doneTopics.has(title) === done) return;
      const before = doneTopics;
      const next = new Set(before);
      if (done) next.add(title);
      else next.delete(title);
      setDoneTopics(next);
      if (preview) return persist(doneMaterials, next);
      startSaving(async () => {
        const res = await completeTopicAction(courseId, title, done);
        if (!res.ok) {
          setError(res.message);
          setDoneTopics(before);
          return;
        }
        setError(null);
        setDoneTopics(new Set(res.data.completedTopics));
        router.refresh();
      });
    },
    [canTrack, courseId, doneMaterials, doneTopics, persist, preview, router],
  );

  const value = useMemo<CourseProgressCtx>(
    () => ({ doneMaterials, doneTopics, progress, canTrack: canTrack || preview, preview, saving, error, completeMaterial, setTopicDone }),
    [doneMaterials, doneTopics, progress, canTrack, preview, saving, error, completeMaterial, setTopicDone],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// [useCourseProgress]: hook de consumo | lanza si falta el Provider (Fail Fast)
export function useCourseProgress(): CourseProgressCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCourseProgress debe usarse dentro de <CourseProgressProvider>");
  return ctx;
}

// [progressDetail]: «2 de 6 subtemas · 1 de 4 recursos · 0 de 3 lecciones» (solo las partes que existen) | [Principio]: DRY (lo usan las dos barras)
export const progressDetail = (p: CourseProgress): string =>
  [
    p.topics.total ? `${p.topics.done} de ${p.topics.total} subtemas` : "",
    p.materials.total ? `${p.materials.done} de ${p.materials.total} recursos` : "",
    p.lessons.total ? `${p.lessons.done} de ${p.lessons.total} lecciones de la ruta` : "",
  ]
    .filter(Boolean)
    .join(" · ");
