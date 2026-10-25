// [Capa: Application — casos de uso de navegación.]
// [Hexagonal/DIP — Port INavRepository inyectado.]

import type { INavRepository } from '../../domain/ports/INavRepository'
import type { NavItem, SupportedLocale } from '../../domain/entities/NavItem'

// [typescript: factory que devuelve dos lecturas; agrupadas por cohesión funcional.]
export function makeGetNavigation(repo: INavRepository) {
  return {
    // [arrow function — cierre sobre repo. Sin estado externo (puro).]
    getNavItems: (): readonly NavItem[] => repo.getNavItems(),
    getSupportedLocales: (): readonly SupportedLocale[] => repo.getSupportedLocales(),
  }
}
