// [Capa: Application — caso de uso GetSkills.]
// [SOLID/DIP: dependemos del puerto ISkillsRepository, no del adapter concreto.]

import type { ISkillsRepository } from '../../domain/ports/ISkillsRepository'
import type { Skill } from '../../domain/entities/Skill'

// [typescript: factory pura. SRP: una sola razón de cambio.]
export function makeGetSkills(repo: ISkillsRepository) {
  return (): readonly Skill[] => repo.getAll()
}
