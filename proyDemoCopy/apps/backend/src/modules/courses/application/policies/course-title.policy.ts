import {
  duplicateTitleError,
  firstDuplicate,
} from '../../../../shared/application/unique-title';
import type { ICourseRepository } from '../../domain/interfaces/course.repository.interface';
// [Policy CourseTitle · 2026-10-28]: no se repiten cursos con el mismo título (normalizado: sin tildes, mayúsculas ni signos) en el mismo idioma (grupo) + nivel (categoría) → 409
// [Patrón]: Policy / Guard Clause + Repository (lectura ligera id + título) | [Principio]: DRY (alta y edición) + SRP + Fail Fast | [Paradigma]: Funcional + async/await
export async function assertUniqueCourseTitle(
  repo: ICourseRepository,
  title: string,
  group: string,
  category: string,
  excludeId?: string,
): Promise<void> {
  const dup = firstDuplicate(
    await repo.findTitlesInScope(group, category),
    title,
    excludeId,
  );
  // `group.toLowerCase()`: los grupos de idioma (EN, FR…) coinciden con los códigos ISO → nombre en español en el mensaje; los legados se muestran tal cual
  if (dup)
    throw duplicateTitleError(dup.title, {
      label: 'un curso',
      language: group.toLowerCase(),
      level: category,
    });
}
