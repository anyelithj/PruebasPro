import type { CefrLevel } from '../../../../shared/domain/cefr-level.vo';
import type { Language } from '../../../../shared/domain/language.vo';
import type { LanguageSkill } from '../../../../shared/domain/language-skill.vo';
import type { CurriculumItem } from '../entities/curriculum-item.entity';
import type {
  CurriculumItemRevision,
  RevisionChangeType,
} from '../entities/curriculum-item-revision.entity';
import type { CurriculumSource } from '../entities/curriculum-source.entity';
import type { CurriculumTopic } from '../entities/curriculum-topic.entity';
import type { ComparableItem } from '../source-comparison';
import type { CurriculumItemKind } from '../value-objects/curriculum-item-kind.vo';
import type { Provenance } from '../value-objects/provenance.vo';
import type { ReviewStatus } from '../value-objects/review-status.vo';
// [Port ICurriculumRepository]: contrato del dominio; la infraestructura (TypeORM) lo implementa | [Patrón]: Port (Hexagonal) + Repository | [Principio]: DIP + ISP | [Paradigma]: POO (interfaz)
// `import type` (TS): importa solo tipos → cero código en runtime y sin acoplamiento a la implementación

// `Symbol` (ES2015): token único de inyección de dependencias (evita colisiones de nombres en el contenedor de Nest)
export const CURRICULUM_REPOSITORY = Symbol('CURRICULUM_REPOSITORY');

// [Criterios de consulta]: lado Query de CQRS | `?` (TS): todos opcionales
export interface CurriculumSearchCriteria {
  language?: Language;
  level?: CefrLevel;
  skill?: LanguageSkill;
  kind?: CurriculumItemKind;
  provenance?: Provenance;
  statuses?: ReadonlyArray<ReviewStatus>; // Estudiantes: solo APPROVED (lo fuerza el caso de uso)
  search?: string; // Coincidencia en key/topic
  topic?: string; // Tema exacto (sin distinguir mayúsculas) → página de un tema
  page: number;
  limit: number;
}

// [Resumen por tema]: una tarjeta por tema + idioma + nivel en /resources | [Patrón]: Read Model (CQRS)
export interface TopicGroup {
  topic: string;
  language: Language;
  level: CefrLevel;
  count: number; // Recursos del tema
  approved: number; // Cuántos están publicados (aprobados) → estado del grupo en Gestión
  kinds: CurriculumItemKind[]; // Tipos presentes (vocabulario, frases…)
  emoji: string | null; // Primer emoji del vocabulario del tema (portada de la tarjeta)
}

// [Resultado paginado]: genérico reutilizable
export interface Paginated<T> {
  data: T[]; // `T[]` (TS): array del tipo genérico
  total: number;
  page: number;
  limit: number;
}

// [Metadatos de revisión]: lo que el caso de uso aporta; snapshot/versión los calcula el adapter
export interface RevisionMeta {
  changeType: RevisionChangeType;
  changedBy: string;
  note?: string | null;
}

// `export interface` (TS): contrato; `Promise<T>` → todas las operaciones son asíncronas (async/await)
export interface ICurriculumRepository {
  findById(id: string): Promise<CurriculumItem | null>; // `| null` (TS): ausencia explícita
  findByNaturalKey(
    language: Language,
    kind: CurriculumItemKind,
    key: string,
  ): Promise<CurriculumItem | null>;
  search(
    criteria: CurriculumSearchCriteria,
  ): Promise<Paginated<CurriculumItem>>;
  // [Agrupación por tema]: mismos filtros que search (sin paginación), máx. 200 grupos
  groupByTopic(
    criteria: Omit<CurriculumSearchCriteria, 'page' | 'limit'>,
    perKind?: boolean,
  ): Promise<TopicGroup[]>;
  listRevisions(itemId: string): Promise<CurriculumItemRevision[]>;
  // [Escrituras transaccionales]: ítem + revisión se guardan juntos o no se guarda nada | [Patrón]: Unit of Work
  createWithRevision(
    item: Partial<CurriculumItem>,
    meta: RevisionMeta,
  ): Promise<CurriculumItem>;
  // [Concurrencia optimista]: falla con conflicto si la versión en BD ya no es `expectedVersion`
  saveWithRevision(
    item: CurriculumItem,
    expectedVersion: number,
    meta: RevisionMeta,
  ): Promise<CurriculumItem>;
  // [Baja definitiva]: borra el ítem y su historial en una transacción (las trazas de IA se conservan: son un registro independiente)
  remove(id: string): Promise<void>;
  // [Catálogo de temas]: búsqueda acotada por combinación + texto, con límite
  searchTopics(criteria: TopicSearchCriteria): Promise<CurriculumTopic[]>;
  findTopicById(id: string): Promise<CurriculumTopic | null>;
  findTopic(
    language: Language,
    level: CefrLevel,
    skill: LanguageSkill,
    slug: string,
  ): Promise<CurriculumTopic | null>;
  createTopic(topic: Partial<CurriculumTopic>): Promise<CurriculumTopic>;
  // [Catálogo de fuentes]
  searchSources(
    search: string | undefined,
    limit: number,
  ): Promise<CurriculumSource[]>;
  findSourceById(id: string): Promise<CurriculumSource | null>;
  findSourceBySlug(slug: string): Promise<CurriculumSource | null>;
  createSource(source: Partial<CurriculumSource>): Promise<CurriculumSource>;
  // [Comparación entre fuentes · Etapa 4]: recursos no archivados de un idioma y tipo, con sus banderas actuales
  listForComparison(
    language: Language,
    kind: CurriculumItemKind,
  ): Promise<Array<ComparableItem & { flags: string[] }>>;
  // [Bandera]: la pone en `on` y la quita de `off` SIN incrementar la versión (no es un cambio editorial)
  setFlag(
    flag: string,
    on: ReadonlyArray<string>,
    off: ReadonlyArray<string>,
  ): Promise<void>;
}

// [Criterios de temas]: idioma, nivel y competencia obligatorios → nunca se carga el catálogo completo
export interface TopicSearchCriteria {
  language: Language;
  level: CefrLevel;
  skill: LanguageSkill;
  kind?: CurriculumItemKind; // Incluye temas sin tipo (aplican a todos)
  search?: string;
  limit: number;
}

// [Error de dominio]: `class ... extends Error` (ES2015) para distinguir conflictos de versión de otros errores
export class CurriculumVersionConflictError extends Error {
  constructor(id: string, expected: number) {
    super(
      `El recurso ${id} fue modificado por otra persona (versión esperada ${expected}). Recarga y vuelve a intentar.`,
    ); // `super` llama al constructor de Error
    this.name = 'CurriculumVersionConflictError'; // Nombre legible en logs
  }
}
