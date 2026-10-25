// [Capa: Composables — Data Provider Pattern (Vue 3 Composition API).]
// [Hexagonal: este composable es el cliente de la application layer.]
// [Patrón Vue: Composable + Provide/Inject. Patrón Vue 3 oficial: "Composables".]

// [vue: inject — recupera dependencia provista en árbol ascendente.]
import { inject } from 'vue'

// [Token InjectionKey<ISocialLinksRepository> — type-safe DI.]
import { SOCIAL_LINKS_REPO } from '~/shared/domain/tokens'

// [Use Case factory.]
import { makeGetSocialLinks } from '~/shared/application/use-cases/GetSocialLinks'

// [typescript: import type — solo tipo, cero JS.]
import type { SocialLink } from '~/shared/domain/entities/SocialLink'

// [typescript: function — composable. Convención Vue: prefijo `use`.]
// [Devuelve datos como readonly (inmutabilidad hacia el consumidor).]
export function useSocialLinks(): { links: readonly SocialLink[] } {
  // [vue: inject(token) — busca el provider; si no existe, lanza error en strict mode.]
  // [Patrón: defensa explícita en lugar de fallback silencioso (fail-fast).]
  const repo = inject(SOCIAL_LINKS_REPO)

  // [typescript: if (!repo) — narrow + error temprano.]
  if (!repo) {
    throw new Error(
      '[useSocialLinks] ISocialLinksRepository no está provisto. Verifica plugins/di.ts.',
    )
  }

  // [Use case construido con el repo inyectado. Composición funcional.]
  const getSocialLinks = makeGetSocialLinks(repo)

  // [typescript: return objeto con propiedad nombrada — patrón "named exports" de composables.]
  return { links: getSocialLinks() }
}
