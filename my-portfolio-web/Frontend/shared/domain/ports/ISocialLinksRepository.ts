// [Capa: Domain/Ports — contrato (interface) para el repositorio de redes sociales.]
// [Hexagonal: Port = interfaz definida por el dominio; Adapters (infrastructure) la implementan.]
// [Paradigma: DIP (Dependency Inversion Principle, SOLID). Dominio define la abstracción, no depende de detalles.]

// [typescript: import type — solo tipo, no runtime.]
import type { SocialLink } from '../entities/SocialLink'

// [typescript: interface — contrato del repositorio.]
// [Patrón: Repository — encapsula acceso a datos detrás de una abstracción.]
export interface ISocialLinksRepository {
  // [Método getAll — devuelve lista de links. readonly para impedir mutación tras la lectura (inmutabilidad).]
  // [Sync (no Promise) porque la fuente actual es estática; si migra a API, cambiar firma a Promise<readonly SocialLink[]>.]
  getAll(): readonly SocialLink[]
}
