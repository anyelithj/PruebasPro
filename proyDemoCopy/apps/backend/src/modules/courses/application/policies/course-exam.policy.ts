import { BadRequestException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
// [Policy · 2026-11-10 · «publicar bloqueado hasta que se cree el examen»]: un curso solo se publica con examen final (da el certificado)
// Consulta directa a «quizzes» → CoursesModule no importa QuizModule (evita el ciclo de módulos)

export async function assertHasFinalExam(
  db: DataSource,
  courseId: string,
): Promise<void> {
  const [exam] = (await db.query(
    `SELECT 1 FROM quizzes WHERE course_id = $1 AND kind = 'final' LIMIT 1`,
    [courseId],
  )) as unknown[];
  if (!exam)
    throw new BadRequestException(
      'Crea el examen final del curso antes de publicarlo (da el certificado).',
    );
}
