// [Domain Event CourseCompleted · 2026-11-06]: el alumno llegó al 100 % del curso → Quiz prepara el examen final | [Patrón]: Observer

export const COURSE_COMPLETED_EVENT = 'course.completed';

export interface CourseCompletedEvent {
  userId: string;
  courseId: string;
}
