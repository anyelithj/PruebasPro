// [Capa: Domain/Ports — contrato del repositorio de habilidades.]
// [DIP — abstracción depende del dominio, implementación en infrastructure.]

import type { Skill } from '../entities/Skill'

// [typescript: interface — Port para listar habilidades.]
export interface ISkillsRepository {
  getAll(): readonly Skill[]
}
