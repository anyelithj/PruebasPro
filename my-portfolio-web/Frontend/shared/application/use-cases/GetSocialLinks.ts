// [Capa: Application — Use Case (caso de uso).]
// [Hexagonal: orquesta el dominio sin conocer detalles de UI ni de almacenamiento.]
// [Paradigma: Functional Core (función pura sobre el repositorio inyectado).]

// [typescript: import type — solo tipos, cero runtime.]
import type { ISocialLinksRepository } from '../../domain/ports/ISocialLinksRepository'
import type { SocialLink } from '../../domain/entities/SocialLink'

// [typescript: function declaration — exporta caso de uso. Currying-friendly: recibe el puerto, retorna función.]
// [Patrón: Use Case como factory + closure. SOLID/SRP: una sola razón de cambio (cómo se obtienen los links).]
export function makeGetSocialLinks(repo: ISocialLinksRepository) {
  // [typescript: return arrow function — cierre sobre `repo`. Inmutable por diseño.]
  return (): readonly SocialLink[] => repo.getAll()
}
