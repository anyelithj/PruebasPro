// [course-progress · 2026-10-28]: progreso REAL de un curso calculado igual en todas las barras (página de la lección, temario, recursos)
// Fórmula = espejo de NestJS (course-materials.use-case → recompute): (recursos vistos + subtemas estudiados [+ lecciones de la ruta]) / (recursos + subtemas [+ lecciones])
// Las «lecciones de la ruta» (outline.summary) las suma también el detalle del curso → mismo % en el detalle y en la lección | [Patrón]: Pure Function + Value Object | [Principio]: SSOT + DRY | [Paradigma]: Funcional (sin red ni estado → se prueba con Jest)
// [Fix 2026-10-28]: antes cada barra contaba algo distinto (la lección solo recursos, el detalle recursos + subtemas + ruta) → al estudiar un subtema la barra de la lección no se movía

// [Part]: avance de un tipo de contenido | `Readonly` (TS): el resultado no se muta
export interface ProgressPart {
  readonly done: number;
  readonly total: number;
}

export interface CourseProgress extends ProgressPart {
  readonly pct: number; // 0..100 entero
  readonly materials: ProgressPart;
  readonly topics: ProgressPart;
  readonly lessons: ProgressPart;
}

export interface CourseProgressInput {
  materialIds: ReadonlyArray<string>; // Recursos que EXISTEN hoy (ids)
  doneMaterials: ReadonlySet<string> | ReadonlyArray<string>;
  topicTitles: ReadonlyArray<string>; // Subtemas del temario («## …» → parseSyllabus)
  doneTopics: ReadonlySet<string> | ReadonlyArray<string>;
  lessons?: ProgressPart; // `?` (TS): opcional → resumen de la ruta (outline.summary) si el curso la tiene
}

// [toSet]: acepta Set o Array → `Set` (ES2015) para pertenencia O(1) | [Principio]: robustez en la frontera
const toSet = (v: ReadonlySet<string> | ReadonlyArray<string>): ReadonlySet<string> => (v instanceof Set ? v : new Set(v as ReadonlyArray<string>));

// [pctOf]: porcentaje entero acotado 0..100 | `Math.min/max` evitan >100 con datos antiguos | [Principio]: DRY (lo usan las barras parciales)
export const pctOf = (done: number, total: number): number => (total > 0 ? Math.max(0, Math.min(100, Math.round((done / total) * 100))) : 0);

// [courseProgress]: SOLO cuenta ids/títulos que siguen existiendo (un recurso borrado o un subtema renombrado no infla el %)
export function courseProgress({ materialIds, doneMaterials, topicTitles, doneTopics, lessons }: CourseProgressInput): CourseProgress {
  const dm = toSet(doneMaterials);
  const dt = toSet(doneTopics);
  const materials = { done: materialIds.filter((id) => dm.has(id)).length, total: materialIds.length };
  const topics = { done: topicTitles.filter((t) => dt.has(t)).length, total: topicTitles.length };
  const route = lessons ? { done: Math.min(lessons.done, lessons.total), total: lessons.total } : { done: 0, total: 0 };
  const done = materials.done + topics.done + route.done;
  const total = materials.total + topics.total + route.total;
  return { done, total, pct: pctOf(done, total), materials, topics, lessons: route };
}
