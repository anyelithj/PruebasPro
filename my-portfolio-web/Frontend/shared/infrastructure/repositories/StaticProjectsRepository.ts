// [Capa: Infrastructure/Adapters — implementa IProjectsRepository con datos estáticos.]
// [Patrón: Repository Adapter. Hexagonal — sustituible por una API real sin tocar UI.]

import type { IProjectsRepository } from '../../domain/ports/IProjectsRepository'
import type { Project } from '../../domain/entities/Project'

// [typescript: as const — array readonly inmutable.]
const PROJECTS: readonly Project[] = [
  {
    id: 'vue-notes-app',
    title: 'Web App con Vue & Supabase',
    description: 'Aplicación de notas colaborativas en tiempo real.',
    link: 'https://github.com/tu_usuario/vue-notes-app',
    techs: ['Vue', 'Supabase', 'TailwindCSS'],
  },
  {
    id: 'task-api',
    title: 'API con Node y Mongo',
    description: 'API REST para tareas, usuarios y autenticación.',
    link: 'https://github.com/tu_usuario/task-api',
    techs: ['Node.js', 'Express', 'MongoDB'],
  },
  {
    id: 'dashboard-react-django',
    title: 'Dashboard con React y Django',
    description: 'Dashboard de administración moderno y escalable.',
    link: 'https://github.com/tu_usuario/dashboard-react-django',
    techs: ['React', 'Django', 'Chart.js'],
  },
] as const

// [Factory function — adapter que cumple el Port.]
export function createStaticProjectsRepository(): IProjectsRepository {
  return {
    getAll: () => PROJECTS,
  }
}
