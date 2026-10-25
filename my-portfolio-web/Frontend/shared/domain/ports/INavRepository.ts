// [Capa: Domain/Ports — repositorio de items de navegación e idiomas soportados.]
// [DIP, Patrón Repository.]

import type { NavItem, SupportedLocale } from '../entities/NavItem'

// [typescript: interface — Port unificado para navegación + locales (cohesión funcional).]
export interface INavRepository {
  getNavItems(): readonly NavItem[]            // [Items del menú principal.]
  getSupportedLocales(): readonly SupportedLocale[] // [Lista de idiomas para el selector i18n.]
}
