import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  DataSource,
  EntityManager,
  Not,
  type ObjectLiteral,
  Repository,
  type SelectQueryBuilder,
} from 'typeorm';
import { CurriculumItem } from '../../domain/entities/curriculum-item.entity';
import { CurriculumItemRevision } from '../../domain/entities/curriculum-item-revision.entity';
import {
  CurriculumSource,
  OWN_CONTENT_SOURCE_SLUG,
} from '../../domain/entities/curriculum-source.entity';
import { CurriculumTopic } from '../../domain/entities/curriculum-topic.entity';
import { slugify } from '../../domain/slug';
import { ReviewStatus } from '../../domain/value-objects/review-status.vo';
import { CefrLevel } from '../../../../shared/domain/cefr-level.vo';
import { LanguageSkill } from '../../../../shared/domain/language-skill.vo';
import {
  CurriculumVersionConflictError,
  type CurriculumSearchCriteria,
  type ICurriculumRepository,
  type Paginated,
  type RevisionMeta,
  type TopicGroup,
  type TopicSearchCriteria,
} from '../../domain/interfaces/curriculum.repository.interface';
import type { CurriculumItemKind } from '../../domain/value-objects/curriculum-item-kind.vo';
import { Language } from '../../../../shared/domain/language.vo';

// [Seed de temas]: únicamente la lista de ejemplo indicada por el autor (inglés · A1 · gramática); el resto se crea desde la UI
const SEED_TOPICS_EN_A1_GRAMMAR: ReadonlyArray<string> = [
  'Verb to be',
  'Personal pronouns',
  'Articles',
  'Plural nouns',
  'Present Simple',
  'There is / There are',
  "Can / Can't",
  'Basic prepositions',
];
// [Adapter TypeORM del puerto ICurriculumRepository]: traduce el contrato del dominio a SQL sobre PostgreSQL | [Patrón]: Adapter (Hexagonal) + Repository + Unit of Work (transacciones) | [Principio]: DIP + LSP + SRP | [Paradigma]: POO + async/await
// [Tecnología]: TypeORM (QueryBuilder, EntityManager, transacciones) + PostgreSQL (jsonb, bloqueo FOR UPDATE)

@Injectable()
// `implements` (TS): el compilador verifica que la clase cumple el contrato del puerto
export class CurriculumRepository
  implements ICurriculumRepository, OnModuleInit
{
  private readonly logger = new Logger(CurriculumRepository.name);

  constructor(
    // `@InjectRepository` (@nestjs/typeorm): repositorio TypeORM de la entidad
    @InjectRepository(CurriculumItem)
    private readonly items: Repository<CurriculumItem>,
    @InjectRepository(CurriculumItemRevision)
    private readonly revisions: Repository<CurriculumItemRevision>,
    @InjectRepository(CurriculumTopic)
    private readonly topics: Repository<CurriculumTopic>,
    @InjectRepository(CurriculumSource)
    private readonly sources: Repository<CurriculumSource>,
    // `@InjectDataSource` (@nestjs/typeorm): conexión para abrir transacciones explícitas
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // [Seed idempotente]: crea la fuente "Contenido propio" y los temas de ejemplo solo si no existen
  async onModuleInit(): Promise<void> {
    try {
      if (
        !(await this.sources.findOne({
          where: { slug: OWN_CONTENT_SOURCE_SLUG },
        }))
      ) {
        await this.sources.save(
          this.sources.create({
            name: 'Contenido propio',
            slug: OWN_CONTENT_SOURCE_SLUG,
            type: 'propio',
            attribution: 'Contenido elaborado para la plataforma.',
            isOwnContent: true,
          }),
        );
      }
      const existing = await this.topics.find({
        select: { slug: true },
        where: {
          language: Language.EN,
          level: CefrLevel.A1,
          skill: LanguageSkill.GRAMMAR,
        },
      });
      const known = new Set(existing.map((t) => t.slug));
      const missing = SEED_TOPICS_EN_A1_GRAMMAR.filter(
        (n) => !known.has(slugify(n)),
      );
      if (missing.length) {
        await this.topics.save(
          missing.map((name) =>
            this.topics.create({
              name,
              slug: slugify(name),
              language: Language.EN,
              level: CefrLevel.A1,
              skill: LanguageSkill.GRAMMAR,
              kind: null,
              parentId: null,
              createdBy: null,
            }),
          ),
        );
      }
    } catch (err) {
      this.logger.warn(
        `Seed de catálogo curricular no ejecutado: ${(err as Error).message}`,
      );
    }
  }

  // ───── Catálogo de temas ─────
  searchTopics(c: TopicSearchCriteria): Promise<CurriculumTopic[]> {
    const qb = this.topics
      .createQueryBuilder('t')
      .where(
        't.language = :language AND t.level = :level AND t.skill = :skill',
        {
          language: c.language,
          level: c.level,
          skill: c.skill,
        },
      );
    // [Tipo]: temas sin tipo aplican a todos; con tipo, solo al suyo
    if (c.kind)
      qb.andWhere('(t.kind IS NULL OR t.kind = :kind)', { kind: c.kind });
    if (c.search) qb.andWhere('t.name ILIKE :q', { q: `%${c.search}%` });
    return qb.orderBy('t.name', 'ASC').take(c.limit).getMany(); // Límite: nunca el catálogo completo
  }

  findTopicById(id: string): Promise<CurriculumTopic | null> {
    return this.topics.findOne({ where: { id } });
  }

  findTopic(
    language: Language,
    level: CefrLevel,
    skill: LanguageSkill,
    slug: string,
  ): Promise<CurriculumTopic | null> {
    return this.topics.findOne({ where: { language, level, skill, slug } });
  }

  createTopic(topic: Partial<CurriculumTopic>): Promise<CurriculumTopic> {
    return this.topics.save(this.topics.create(topic));
  }

  // ───── Catálogo de fuentes ─────
  searchSources(
    search: string | undefined,
    limit: number,
  ): Promise<CurriculumSource[]> {
    const qb = this.sources.createQueryBuilder('s');
    if (search) qb.where('s.name ILIKE :q', { q: `%${search}%` });
    // "Contenido propio" primero, luego alfabético
    return qb
      .orderBy('s.isOwnContent', 'DESC')
      .addOrderBy('s.name', 'ASC')
      .take(limit)
      .getMany();
  }

  findSourceById(id: string): Promise<CurriculumSource | null> {
    return this.sources.findOne({ where: { id } });
  }

  findSourceBySlug(slug: string): Promise<CurriculumSource | null> {
    return this.sources.findOne({ where: { slug } });
  }

  createSource(source: Partial<CurriculumSource>): Promise<CurriculumSource> {
    return this.sources.save(this.sources.create(source));
  }

  findById(id: string): Promise<CurriculumItem | null> {
    return this.items.findOne({ where: { id } }); // SELECT por PK (índice primario)
  }

  findByNaturalKey(
    language: Language,
    kind: CurriculumItemKind,
    key: string,
  ): Promise<CurriculumItem | null> {
    return this.items.findOne({ where: { language, kind, key } }); // Usa el índice único uq_curriculum_natural_key
  }

  async search(
    c: CurriculumSearchCriteria,
  ): Promise<Paginated<CurriculumItem>> {
    const limit = Math.min(100, Math.max(1, c.limit)); // Acota el tamaño de página (protege memoria y red)
    const page = Math.max(1, c.page);
    const qb = this.applyFilters(this.items.createQueryBuilder('i'), c); // `createQueryBuilder` (TypeORM): SQL parametrizado (evita inyección)

    qb.orderBy('i.language', 'ASC')
      .addOrderBy('i.level', 'ASC')
      .addOrderBy('i.key', 'ASC'); // Orden estable y predecible
    qb.skip((page - 1) * limit).take(limit); // OFFSET/LIMIT

    const [data, total] = await qb.getManyAndCount(); // Datos + total en una sola llamada del ORM
    return { data, total, page, limit };
  }

  // [groupByTopic]: una fila por tema/idioma/nivel con conteo, tipos y emoji de portada | SQL: GROUP BY + array_agg + FILTER (PostgreSQL)
  async groupByTopic(
    c: Omit<CurriculumSearchCriteria, 'page' | 'limit'>,
    perKind = false,
  ): Promise<TopicGroup[]> {
    const qb = this.applyFilters(this.items.createQueryBuilder('i'), c)
      .select('i.topic', 'topic')
      .addSelect('i.language', 'language')
      .addSelect('i.level', 'level')
      .addSelect('COUNT(*)::int', 'count') // `::int` (PostgreSQL): el conteo llega como número y no como string
      .addSelect(
        `COUNT(*) FILTER (WHERE i.reviewStatus = 'approved')::int`,
        'approved',
      ) // `FILTER` (PostgreSQL): cuenta solo los publicados
      .addSelect('array_agg(DISTINCT i.kind::text)', 'kinds') // `array_agg DISTINCT`: tipos presentes sin repetir
      .addSelect(
        "(array_agg(i.content->>'emoji') FILTER (WHERE COALESCE(i.content->>'emoji', '') <> ''))[1]",
        'emoji',
      ) // `->>` (JSONB): texto del campo
      .groupBy('i.topic')
      .addGroupBy('i.language')
      .addGroupBy('i.level')
      .orderBy('i.language', 'ASC')
      .addOrderBy('i.level', 'ASC')
      .addOrderBy('i.topic', 'ASC')
      .limit(200); // Tope de grupos (protege memoria y red)
    if (perKind) qb.addGroupBy('i.kind').addOrderBy('i.kind', 'ASC'); // Una fila por tipo dentro del tema (tabla de Gestión)
    const rows = await qb.getRawMany<TopicGroup>();
    return rows.map((r) => ({
      ...r,
      count: Number(r.count),
      approved: Number(r.approved),
      emoji: r.emoji ?? null,
    }));
  }

  // [applyFilters]: condiciones compartidas por search y groupByTopic | [Principio]: DRY | [Patrón]: Specification (query)
  private applyFilters<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    c: Omit<CurriculumSearchCriteria, 'page' | 'limit'>,
  ): SelectQueryBuilder<T> {
    // [Filtros opcionales]: cada `andWhere` añade una condición con parámetros nombrados (:param)
    if (c.language)
      qb.andWhere('i.language = :language', { language: c.language });
    if (c.level) qb.andWhere('i.level = :level', { level: c.level });
    if (c.skill) qb.andWhere('i.skill = :skill', { skill: c.skill });
    if (c.kind) qb.andWhere('i.kind = :kind', { kind: c.kind });
    if (c.provenance)
      qb.andWhere('i.provenance = :provenance', { provenance: c.provenance });
    if (c.statuses?.length)
      qb.andWhere('i.reviewStatus IN (:...statuses)', { statuses: c.statuses }); // `:...` expande el array
    if (c.search) {
      // `Brackets` (TypeORM): agrupa el OR entre paréntesis para no romper los AND anteriores
      qb.andWhere(
        new Brackets((w) => {
          w.where('i.key ILIKE :q', { q: `%${c.search}%` }).orWhere(
            'i.topic ILIKE :q',
            { q: `%${c.search}%` },
          );
        }),
      );
      // [Decisión]: ILIKE basta para el volumen de un autor; FTS de Postgres o embeddings solo si se mide necesidad (ADR 0005)
    }
    if (c.topic)
      qb.andWhere('LOWER(i.topic) = LOWER(:topic)', { topic: c.topic }); // Tema exacto sin distinguir mayúsculas
    return qb;
  }

  listRevisions(itemId: string): Promise<CurriculumItemRevision[]> {
    // Historial más reciente primero; limitado a 200 para acotar la respuesta
    return this.revisions.find({
      where: { itemId },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  async createWithRevision(
    item: Partial<CurriculumItem>,
    meta: RevisionMeta,
  ): Promise<CurriculumItem> {
    // `dataSource.transaction` (TypeORM): BEGIN … COMMIT; si algo lanza → ROLLBACK automático | [Patrón]: Unit of Work
    return this.dataSource.transaction(async (m: EntityManager) => {
      const saved = await m.save(
        CurriculumItem,
        m.create(CurriculumItem, item),
      ); // INSERT (version = 1)
      await this.insertRevision(m, saved, meta); // INSERT en el log de auditoría
      return saved;
    });
  }

  async saveWithRevision(
    item: CurriculumItem,
    expectedVersion: number,
    meta: RevisionMeta,
  ): Promise<CurriculumItem> {
    return this.dataSource.transaction(async (m: EntityManager) => {
      // [Bloqueo de fila]: `pessimistic_write` = SELECT … FOR UPDATE → serializa escrituras concurrentes del mismo ítem
      const current = await m.findOne(CurriculumItem, {
        where: { id: item.id },
        lock: { mode: 'pessimistic_write' },
      });
      // [Concurrencia optimista]: si otra transacción ya cambió la versión, se aborta (ROLLBACK)
      if (!current || current.version !== expectedVersion) {
        throw new CurriculumVersionConflictError(item.id, expectedVersion);
      }
      const saved = await m.save(CurriculumItem, item); // UPDATE; @VersionColumn incrementa version
      await this.insertRevision(m, saved, meta);
      return saved;
    });
  }

  // `private` (TS): detalle interno del adapter; no forma parte del puerto
  // [remove]: historial + ítem en la misma transacción → nunca quedan revisiones huérfanas | [Patrón]: Unit of Work
  async listForComparison(language: Language, kind: CurriculumItemKind) {
    // `select` explícito: solo los campos que compara el dominio (sin historial ni metadatos)
    const rows = await this.items.find({
      select: {
        id: true,
        key: true,
        source: true,
        sourceId: true,
        content: true,
        flags: true,
      },
      where: { language, kind, reviewStatus: Not(ReviewStatus.ARCHIVED) },
    });
    return rows.map((r) => ({
      id: r.id,
      key: r.key,
      source: r.source,
      sourceId: r.sourceId,
      content: r.content,
      flags: r.flags ?? [],
    }));
  }

  async setFlag(
    flag: string,
    on: ReadonlyArray<string>,
    off: ReadonlyArray<string>,
  ): Promise<void> {
    // SQL directo (no `save`/`update` de TypeORM): no incrementa @VersionColumn → un formulario abierto no queda en conflicto | `$1/$2` parametrizados
    if (on.length)
      await this.dataSource.query(
        `UPDATE curriculum_items SET flags = array_append(flags, $1) WHERE id = ANY($2::uuid[]) AND NOT ($1 = ANY(flags))`,
        [flag, [...on]],
      );
    if (off.length)
      await this.dataSource.query(
        `UPDATE curriculum_items SET flags = array_remove(flags, $1) WHERE id = ANY($2::uuid[])`,
        [flag, [...off]],
      );
  }

  async remove(id: string): Promise<void> {
    await this.dataSource.transaction(async (m: EntityManager) => {
      await m.delete(CurriculumItemRevision, { itemId: id });
      await m.delete(CurriculumItem, { id });
    });
  }

  private async insertRevision(
    m: EntityManager,
    item: CurriculumItem,
    meta: RevisionMeta,
  ): Promise<void> {
    // `m.create` + `m.save` (TypeORM): construye la entidad tipada e inserta dentro de la misma transacción
    const revision = m.create(CurriculumItemRevision, {
      itemId: item.id,
      version: item.version,
      changeType: meta.changeType,
      // [Snapshot]: copia serializable del estado tras el cambio | spread (ES2018) crea un objeto plano
      snapshot: { ...item } as unknown as Record<string, unknown>,
      changedBy: meta.changedBy,
      note: meta.note ?? null,
    });
    await m.save(CurriculumItemRevision, revision);
  }
}
