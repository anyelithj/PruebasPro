// [Capa: Domain/Ports — contrato del repositorio de proyectos.]
// [Hexagonal/DIP: dominio especifica la forma; infraestructura provee la implementación.]

import type { Project } from '../entities/Project'

// [typescript: interface — Port. Patrón Repository.]
export interface IProjectsRepository {
  // [getAll — lectura completa. Si se requiriera paginación, evolucionaría sin romper consumidores (OCP).]
  getAll(): readonly Project[]
}
