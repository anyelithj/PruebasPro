// [Domain Event ExamPassed · 2026-11-06]: examen final o de nivel aprobado → Certificates emite el certificado solo | [Patrón]: Observer

export const EXAM_PASSED_EVENT = 'quiz.exam-passed';

export interface ExamPassedEvent {
  userId: string;
  quizId: string;
  courseId: string | null; // null = examen de nivel
  percent: number;
}
