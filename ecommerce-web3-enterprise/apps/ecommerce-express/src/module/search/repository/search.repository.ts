// search.repository.ts => consultas de búsqueda en SQL nativo (PostgreSQL full-text + pgvector).
// Prisma no expresa ts_rank ni el operador <=>: se usa $queryRaw con fragmentos Prisma.sql, que PARAMETRIZAN
// cada valor (nunca se concatena texto del usuario en el SQL => sin inyección SQL).
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../../../config/database.config";
import { SearchHistoryModel } from "../model/search.model";
import type { FacetBucket, SearchFacetsDto, SuggestionDto } from "../dto/search.dto";
import type { PageParams } from "../../../shared/types/pagination.types";
import type { SearchQuery } from "../schema/search.schema";

// Expresión IDÉNTICA a la del índice GIN "products_search_idx" (si difiere, Postgres no usa el índice)
const SEARCH_VECTOR = Prisma.sql`(setweight(to_tsvector('spanish', coalesce(p."name", '')), 'A') || setweight(to_tsvector('spanish', coalesce(p."description", '')), 'B'))`;

// Filtros ya resueltos (categoría expandida a su rama, marca a ID)
export interface ResolvedSearchFilter {
  q: string;
  categoryIds?: string[] | undefined;
  brandId?: string | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  inStock?: boolean | undefined;
  attributes: Array<[string, string]>;
  sort: SearchQuery["sort"];
}

// ORDER BY por criterio (lista cerrada => sin inyección en ORDER BY)
const ORDER_BY: Record<SearchQuery["sort"], Prisma.Sql> = {
  relevance: Prisma.sql`rank DESC, p."createdAt" DESC`,
  price_asc: Prisma.sql`p."minPriceCents" ASC`,
  price_desc: Prisma.sql`p."maxPriceCents" DESC`,
  newest: Prisma.sql`p."createdAt" DESC`,
  rating: Prisma.sql`p."ratingAvg" DESC, p."ratingCount" DESC`,
};

export class SearchRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // searchIds => IDs rankeados + total (COUNT(*) OVER() = total sin una segunda consulta)
  public async searchIds(filter: ResolvedSearchFilter, page: PageParams): Promise<{ ids: string[]; total: number }> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string; total: bigint }>>`
      SELECT p."id", ts_rank(${SEARCH_VECTOR}, query) AS rank, COUNT(*) OVER() AS total
      FROM "products" p, websearch_to_tsquery('spanish', ${filter.q}) query
      WHERE ${this.where(filter)}
      ORDER BY ${ORDER_BY[filter.sort]}
      LIMIT ${page.limit} OFFSET ${page.skip}`;
    // COUNT devuelve BIGINT (bigint de JS): se convierte a number para el DTO
    return { ids: rows.map((row) => row.id), total: Number(rows[0]?.total ?? 0) };
  }

  // facets => conteos por categoría, marca, rango de precio y atributos de variante sobre el conjunto filtrado
  public async facets(filter: ResolvedSearchFilter): Promise<SearchFacetsDto> {
    // CTE "matched" reutilizada por las 4 agregaciones (una sola evaluación del filtro por consulta)
    const matched = Prisma.sql`SELECT p."id", p."categoryId", p."brandId", p."minPriceCents", p."maxPriceCents"
      FROM "products" p, websearch_to_tsquery('spanish', ${filter.q}) query WHERE ${this.where(filter)}`;

    const [categories, brands, price, attributes] = await Promise.all([
      this.prisma.$queryRaw<Array<FacetBucket & { count: bigint }>>`
        WITH matched AS (${matched})
        SELECT c."id", c."name", c."slug", COUNT(*) AS count FROM matched m JOIN "categories" c ON c."id" = m."categoryId"
        GROUP BY c."id" ORDER BY count DESC LIMIT 20`,
      this.prisma.$queryRaw<Array<FacetBucket & { count: bigint }>>`
        WITH matched AS (${matched})
        SELECT b."id", b."name", b."slug", COUNT(*) AS count FROM matched m JOIN "brands" b ON b."id" = m."brandId"
        GROUP BY b."id" ORDER BY count DESC LIMIT 20`,
      this.prisma.$queryRaw<Array<{ min: number | null; max: number | null }>>`
        WITH matched AS (${matched}) SELECT MIN("minPriceCents") AS min, MAX("maxPriceCents") AS max FROM matched`,
      // jsonb_each_text => expande {"size":"M","color":"Rojo"} en filas (key, value) para contarlas
      this.prisma.$queryRaw<Array<{ key: string; value: string; count: bigint }>>`
        WITH matched AS (${matched})
        SELECT kv.key, kv.value, COUNT(DISTINCT v."productId") AS count
        FROM "product_variants" v JOIN matched m ON m."id" = v."productId", jsonb_each_text(v."attributes") kv
        WHERE v."isActive" = true GROUP BY kv.key, kv.value ORDER BY kv.key, count DESC`,
    ]);

    // "reduce" => agrupa las filas planas de atributos en { clave: [{ value, count }] }
    const attributeFacets = attributes.reduce<SearchFacetsDto["attributes"]>((acc, row) => {
      (acc[row.key] ??= []).push({ value: row.value, count: Number(row.count) });
      return acc;
    }, {});
    const toBuckets = (rows: Array<FacetBucket & { count: bigint }>) => rows.map((row) => ({ ...row, count: Number(row.count) }));

    return {
      categories: toBuckets(categories),
      brands: toBuckets(brands),
      price: { min: price[0]?.min ?? 0, max: price[0]?.max ?? 0 },
      attributes: attributeFacets,
    };
  }

  // suggestions => autocompletado: productos, categorías y marcas que contienen el texto
  // ("contains" + mode "insensitive" => ILIKE '%q%' parametrizado por Prisma)
  public async suggestions(q: string): Promise<SuggestionDto[]> {
    const [products, categories, brands] = await Promise.all([
      this.prisma.product.findMany({ where: { status: "ACTIVE", name: { contains: q, mode: "insensitive" } }, select: { name: true, slug: true }, take: 5 }),
      this.prisma.category.findMany({ where: { isActive: true, deletedAt: null, name: { contains: q, mode: "insensitive" } }, select: { name: true, slug: true }, take: 3 }),
      this.prisma.brand.findMany({ where: { isActive: true, deletedAt: null, name: { contains: q, mode: "insensitive" } }, select: { name: true, slug: true }, take: 3 }),
    ]);
    return [
      ...products.map((row) => ({ type: "product" as const, label: row.name, slug: row.slug })),
      ...categories.map((row) => ({ type: "category" as const, label: row.name, slug: row.slug })),
      ...brands.map((row) => ({ type: "brand" as const, label: row.name, slug: row.slug })),
    ];
  }

  // vocabularyNames => textos de los que sale el vocabulario de la corrección ortográfica (RF-06.1): nombres de
  // productos publicados, categorías y marcas activas. Solo la columna "name" (consulta liviana)
  public async vocabularyNames(): Promise<string[]> {
    const [products, categories, brands] = await Promise.all([
      this.prisma.product.findMany({ where: { status: "ACTIVE" }, select: { name: true } }),
      this.prisma.category.findMany({ where: { isActive: true, deletedAt: null }, select: { name: true } }),
      this.prisma.brand.findMany({ where: { isActive: true, deletedAt: null }, select: { name: true } }),
    ]);
    return [...products, ...categories, ...brands].map((row) => row.name);
  }

  // brandNames => marcas activas: candidatas que el motor de visión busca como LOGO en la foto (RF-06.4)
  public async brandNames(limit: number): Promise<Array<{ id: string; name: string }>> {
    return this.prisma.brand.findMany({ where: { isActive: true, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: limit });
  }

  // --- Historial (MongoDB) ---

  public async recordHistory(entry: { userId: string; query: string; filters: object; resultsCount: number; source: "TEXT" | "IMAGE" }): Promise<void> {
    await SearchHistoryModel.create(entry);
  }

  // recentQueries => últimas búsquedas DISTINTAS del usuario (agregación de MongoDB)
  public async recentQueries(userId: string, limit: number): Promise<string[]> {
    const rows = await SearchHistoryModel.aggregate<{ _id: string }>([
      { $match: { userId, source: "TEXT" } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$query", last: { $first: "$createdAt" } } }, // Una fila por texto buscado
      { $sort: { last: -1 } },
      { $limit: limit },
    ]);
    return rows.map((row) => row._id);
  }

  public async clearHistory(userId: string): Promise<number> {
    return (await SearchHistoryModel.deleteMany({ userId })).deletedCount;
  }

  // where => condiciones WHERE compuestas con Prisma.sql (cada filtro ausente no agrega nada: Prisma.empty)
  private where(filter: ResolvedSearchFilter): Prisma.Sql {
    const conditions: Prisma.Sql[] = [Prisma.sql`p."status" = 'ACTIVE'`, Prisma.sql`${SEARCH_VECTOR} @@ query`];
    if (filter.categoryIds?.length) conditions.push(Prisma.sql`p."categoryId" IN (${Prisma.join(filter.categoryIds)})`);
    if (filter.brandId) conditions.push(Prisma.sql`p."brandId" = ${filter.brandId}`);
    if (filter.minPrice !== undefined) conditions.push(Prisma.sql`p."maxPriceCents" >= ${filter.minPrice}`);
    if (filter.maxPrice !== undefined) conditions.push(Prisma.sql`p."minPriceCents" <= ${filter.maxPrice}`);
    if (filter.inStock) {
      conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM "product_variants" v WHERE v."productId" = p."id" AND v."isActive" AND v."stock" - v."reservedStock" > 0)`);
    }
    for (const [key, value] of filter.attributes) {
      // "->>" => extrae el valor del JSONB como texto; clave y valor viajan como parámetros
      conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM "product_variants" v WHERE v."productId" = p."id" AND v."isActive" AND v."attributes"->>${key} = ${value})`);
    }
    return Prisma.join(conditions, " AND ");
  }
}

export const searchRepository = new SearchRepository(prisma);
