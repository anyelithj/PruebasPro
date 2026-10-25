// [Capa: Domain — tokens (símbolos únicos) usados por Provide/Inject de Vue.]
// [Patrón: Vue Provide/Inject + InjectionKey para tipado seguro (DI manual sin librerías externas).]
// [Hexagonal: estos tokens identifican los Ports en el contenedor de DI.]

// [typescript: import type — InjectionKey es un tipo, no runtime.]
// [vue: InjectionKey<T> — clave tipada usada con provide/inject para evitar `any`.]
import type { InjectionKey } from 'vue'

// [typescript: import type — Ports del dominio.]
import type { ISocialLinksRepository } from './ports/ISocialLinksRepository'
import type { IProjectsRepository } from './ports/IProjectsRepository'
import type { ISkillsRepository } from './ports/ISkillsRepository'
import type { INavRepository } from './ports/INavRepository'

// [typescript: const + Symbol — identidad única, garantiza no colisión con otras claves provide/inject.]
// [vue: InjectionKey<TPort> — etiqueta el símbolo con el tipo del puerto, dando type-safety en inject().]
export const SOCIAL_LINKS_REPO: InjectionKey<ISocialLinksRepository> =
  Symbol('SOCIAL_LINKS_REPO')

export const PROJECTS_REPO: InjectionKey<IProjectsRepository> =
  Symbol('PROJECTS_REPO')

export const SKILLS_REPO: InjectionKey<ISkillsRepository> =
  Symbol('SKILLS_REPO')

export const NAV_REPO: InjectionKey<INavRepository> =
  Symbol('NAV_REPO')
