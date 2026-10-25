// [DIP][ISP] puerto async de proyectos — variante que consume una API real.
// [OCP] coexiste con IProjectsRepository (sync/estático) sin modificarlo.
import type { Project } from '../entities/Project';

export interface IProjectsApiRepository {
  getAll(): Promise<readonly Project[]>;
}
