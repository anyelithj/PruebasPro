// [Capa: Composables — Data Provider para Projects.]
// [Patrón Vue: Composable; Patrón Hexagonal: cliente del use case.]

import { inject } from 'vue'
import { PROJECTS_REPO } from '~/shared/domain/tokens'
import { makeGetProjects } from '~/shared/application/use-cases/GetProjects'
import type { Project } from '~/shared/domain/entities/Project'

// [Composable que expone la lista readonly de proyectos.]
export function useProjects(): { projects: readonly Project[] } {
  const repo = inject(PROJECTS_REPO)
  if (!repo) {
    throw new Error('[useProjects] IProjectsRepository no está provisto. Verifica plugins/di.ts.')
  }
  const getProjects = makeGetProjects(repo)
  return { projects: getProjects() }
}
