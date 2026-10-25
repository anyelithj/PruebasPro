// [Capa: Infrastructure/Adapters — implementa INavRepository con datos estáticos.]

import type { INavRepository } from '../../domain/ports/INavRepository'
import type { NavItem, SupportedLocale } from '../../domain/entities/NavItem'

// [typescript: as const — fija literalidad e inmutabilidad.]
const NAV_ITEMS: readonly NavItem[] = [
  { to: '/',         hash: '',         i18nKey: 'nav.home'     },
  { to: '#about',    hash: '#about',    i18nKey: 'nav.about'    },
  { to: '#projects', hash: '#projects', i18nKey: 'nav.projects' },
  { to: '#contact',  hash: '#contact',  i18nKey: 'nav.contact'  },
] as const

const LOCALES: readonly SupportedLocale[] = [
  { code: 'es', flag: '🇪🇸', name: 'Español'   },
  { code: 'en', flag: '🇺🇸', name: 'English'   },
  { code: 'fr', flag: '🇫🇷', name: 'Français'  },
  { code: 'de', flag: '🇩🇪', name: 'Deutsch'   },
  { code: 'pt', flag: '🇵🇹', name: 'Português' },
] as const

// [Factory function que retorna el adapter compatible con INavRepository.]
export function createStaticNavRepository(): INavRepository {
  return {
    getNavItems: () => NAV_ITEMS,
    getSupportedLocales: () => LOCALES,
  }
}
