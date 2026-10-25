// [Capa: Composables — Data Provider para navegación e idiomas.]

import { inject } from 'vue'
import { NAV_REPO } from '~/shared/domain/tokens'
import { makeGetNavigation } from '~/shared/application/use-cases/GetNavigation'
import type { NavItem, SupportedLocale } from '~/shared/domain/entities/NavItem'

// [Composable: expone navItems y locales para la Navbar.]
export function useNavigation(): {
  navItems: readonly NavItem[]
  locales: readonly SupportedLocale[]
} {
  const repo = inject(NAV_REPO)
  if (!repo) {
    throw new Error('[useNavigation] INavRepository no está provisto. Verifica plugins/di.ts.')
  }
  const navService = makeGetNavigation(repo)
  return {
    navItems: navService.getNavItems(),
    locales: navService.getSupportedLocales(),
  }
}
