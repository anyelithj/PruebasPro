// [Capa: Composables — Data Provider para Skills.]

import { inject } from 'vue'
import { SKILLS_REPO } from '~/shared/domain/tokens'
import { makeGetSkills } from '~/shared/application/use-cases/GetSkills'
import type { Skill } from '~/shared/domain/entities/Skill'

// [Composable que expone la lista readonly de skills.]
export function useSkills(): { skills: readonly Skill[] } {
  const repo = inject(SKILLS_REPO)
  if (!repo) {
    throw new Error('[useSkills] ISkillsRepository no está provisto. Verifica plugins/di.ts.')
  }
  const getSkills = makeGetSkills(repo)
  return { skills: getSkills() }
}
