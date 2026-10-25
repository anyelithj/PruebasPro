"use server"; // [Next.js]: Server Action → el token viaja solo en el servidor
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { completeLesson } from "@/lib/curriculum-api"; // [Facade]: POST /curriculum/courses/:id/lessons/:lessonId/complete
// [Server Action de la línea de tiempo]: completa la lección y lleva a la siguiente | [Patrón]: Command + PRG (Post/Redirect/Get) | [Principio]: SRP

// [completeLessonAction]: idempotente en el backend; sin siguiente → vuelve al curso (curso terminado)
export async function completeLessonAction(courseId: string, lessonId: string): Promise<void> {
  const { nextLessonId } = await completeLesson(courseId, lessonId);
  revalidatePath(`/courses/${courseId}`); // La línea de tiempo del curso cambia de estado
  // `redirect` (Next.js): lanza la navegación; nada se ejecuta después
  redirect(nextLessonId ? `/courses/${courseId}/path/${nextLessonId}` : `/courses/${courseId}#timeline-title`);
}
