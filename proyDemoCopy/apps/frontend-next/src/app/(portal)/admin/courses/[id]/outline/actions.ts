"use server"; // [Next.js]: Server Actions → el token viaja solo en el servidor
import { revalidatePath } from "next/cache";
import { fillLessonGap, saveCourseOutline } from "@/lib/curriculum-api"; // [Facade]: PUT …/outline y POST …/lessons/:id/fill
import type { CourseOutline, OutlineLevelInput } from "@/types/curriculum";
// [Server Actions del editor de estructura]: guardar el árbol y generar solo los huecos | [Patrón]: Command | [Principio]: SRP + DRY (mismo contrato de resultado)

export type OutlineResult<T> = { ok: true; data: T } | { ok: false; message: string }; // Unión discriminada (TS)

// [run]: try/catch + revalidación común (editor y vista del curso) | [Patrón]: Template Method funcional
async function run<T>(courseId: string, action: () => Promise<T>): Promise<OutlineResult<T>> {
  try {
    const data = await action();
    revalidatePath(`/courses/${courseId}`); // La línea de tiempo del estudiante cambia
    revalidatePath(`/admin/courses/${courseId}/outline`);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

// [saveOutlineAction]: estructura primero → el backend enlaza los recursos existentes y devuelve el árbol con los huecos
export async function saveOutlineAction(courseId: string, levels: OutlineLevelInput[]): Promise<OutlineResult<CourseOutline>> {
  return run(courseId, () => saveCourseOutline(courseId, levels));
}

// [fillGapAction]: genera contenido SOLO para una lección vacía (existente → caché → LLM); lo creado nace «Generado por IA»
export async function fillGapAction(courseId: string, lessonId: string): Promise<OutlineResult<{ created: number; reused: number }>> {
  return run(courseId, () => fillLessonGap(courseId, lessonId, 5));
}
