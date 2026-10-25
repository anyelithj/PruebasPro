// [Capa: Composition Root — único lugar donde se ensamblan dominio + infraestructura.]
// [Patrón: Provide/Inject de Vue como contenedor DI ligero — sin librería externa (KISS).]
// [Hexagonal: aquí se "enchufan" los adapters concretos a los Ports del dominio.]
// [dep: nuxt — defineNuxtPlugin registra el plugin en el ciclo de vida de la app.]

// [typescript: import — runtime. Plugin de Nuxt.]
import { defineNuxtPlugin } from '#app'

// [typescript: import type — solo tipos. No genera bundle.]
import type { ISocialLinksRepository } from '~/shared/domain/ports/ISocialLinksRepository'
import type { IProjectsRepository } from '~/shared/domain/ports/IProjectsRepository'
import type { ISkillsRepository } from '~/shared/domain/ports/ISkillsRepository'
import type { INavRepository } from '~/shared/domain/ports/INavRepository'

// [Tokens InjectionKey<T> — claves tipadas Provide/Inject.]
import {
  SOCIAL_LINKS_REPO,
  PROJECTS_REPO,
  SKILLS_REPO,
  NAV_REPO,
} from '~/shared/domain/tokens'

// [Adapters concretos.]
import { createStaticSocialLinksRepository } from '~/shared/infrastructure/repositories/StaticSocialLinksRepository'
import { createStaticProjectsRepository } from '~/shared/infrastructure/repositories/StaticProjectsRepository'
import { createStaticSkillsRepository } from '~/shared/infrastructure/repositories/StaticSkillsRepository'
import { createStaticNavRepository } from '~/shared/infrastructure/repositories/StaticNavRepository'

// [defineNuxtPlugin — runtime hook de Nuxt. Se ejecuta al iniciar la app.]
export default defineNuxtPlugin((nuxtApp) => {
  // [typescript: const — instancias inmutables de los adapters.]
  // [Patrón Composition Root: cableamos puertos ↔ adapters una sola vez.]
  const socialRepo: ISocialLinksRepository = createStaticSocialLinksRepository()
  const projectsRepo: IProjectsRepository = createStaticProjectsRepository()
  const skillsRepo: ISkillsRepository = createStaticSkillsRepository()
  const navRepo: INavRepository = createStaticNavRepository()

  // [vue: provide — registra dependencia en el árbol Vue. Se consume con inject().]
  // [Por qué nuxtApp.vueApp.provide vs nuxtApp.provide: queremos provide() de Vue (no la API de Nuxt) para usar InjectionKey<T>.]
  nuxtApp.vueApp.provide(SOCIAL_LINKS_REPO, socialRepo)
  nuxtApp.vueApp.provide(PROJECTS_REPO, projectsRepo)
  nuxtApp.vueApp.provide(SKILLS_REPO, skillsRepo)
  nuxtApp.vueApp.provide(NAV_REPO, navRepo)
})
