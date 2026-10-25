// [Capa: Infrastructure/Adapters — implementa ISkillsRepository con datos estáticos.]
// [Patrón: Repository Adapter (Hexagonal).]

import type { ISkillsRepository } from '../../domain/ports/ISkillsRepository'
import type { Skill } from '../../domain/entities/Skill'

// [typescript: as const — congela el array y los tuples internos como literales.]
const SKILLS: readonly Skill[] = [
  { id: 'vue',     name: 'Vue',        icon: ['fab', 'vuejs'],   isBrand: true  },
  { id: 'react',   name: 'React',      icon: ['fab', 'react'],   isBrand: true  },
  { id: 'js',      name: 'JavaScript', icon: ['fab', 'js'],      isBrand: true  },
  { id: 'python',  name: 'Python',     icon: ['fab', 'python'],  isBrand: true  },
  { id: 'django',  name: 'Django',     icon: ['fas', 'leaf'],    isBrand: false },
  { id: 'node',    name: 'Node.js',    icon: ['fab', 'node-js'], isBrand: true  },
  { id: 'express', name: 'Express',    icon: ['fas', 'server'],  isBrand: false },
  { id: 'mongo',   name: 'MongoDB',    icon: ['fas', 'database'], isBrand: false },
  { id: 'mysql',   name: 'MySQL',      icon: ['fas', 'database'], isBrand: false },
  { id: 'github',  name: 'GitHub',     icon: ['fab', 'github'],  isBrand: true  },
] as const

// [Factory — devuelve adapter cumpliendo el Port (DIP).]
export function createStaticSkillsRepository(): ISkillsRepository {
  return {
    getAll: () => SKILLS,
  }
}
