// [Capa: Application — caso de uso GetProjects.]
// [Hexagonal: depende del Port IProjectsRepository, no de su implementación (DIP).]

import type { IProjectsRepository } from '../../domain/ports/IProjectsRepository'
import type { Project } from '../../domain/entities/Project'

// [typescript: factory function — inyectamos el repo y devolvemos la operación.]
// [Patrón: Use Case + Pure Function. Composición funcional.]
export function makeGetProjects(repo: IProjectsRepository) {
  return (): readonly Project[] => repo.getAll()
}
