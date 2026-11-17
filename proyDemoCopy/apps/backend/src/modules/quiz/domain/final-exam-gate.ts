import type { DataSource } from 'typeorm';

// [finalExamUnlocked · 2026-11-11 · «hice el curso al 100 % y el examen sigue bloqueado»]: alumno con el curso comprado y al 100 %
// O quien gestiona el curso (su autor o un ADMIN): su avance es una vista previa del navegador, sin matrícula → antes quedaba bloqueado siempre
export async function finalExamUnlocked(db: DataSource, userId: string, courseId: string): Promise<boolean> {
  const [row] = await db.query(
    `SELECT ((e.purchased_at IS NOT NULL AND e.progress >= 100) OR c.created_by = $1 OR u.role = 'ADMIN') AS ok
       FROM courses c LEFT JOIN users u ON u.id = $1
       LEFT JOIN course_enrollments e ON e.course_id = c.id AND e.user_id = $1
      WHERE c.id = $2`,
    [userId, courseId],
  );
  return row?.ok === true;
}
