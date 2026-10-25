// graph.repository.ts => aristas del grafo de productos (PostgreSQL vía Prisma) + resultados guardados (MongoDB).
// Persistencia políglota detrás de UN repository (DIP): el service no sabe qué motor responde cada consulta.
// Las consultas usan $queryRaw con plantilla etiquetada: Prisma parametriza cada ${valor} (sin inyección SQL).
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../../../config/database.config";
import { productRepository } from "../../product/repository/product.repository";
import { GraphResultModel, type GraphQueryType } from "../model/graph.model";
import type { GraphEdgeDto, GraphNodeDto, GraphQueryDto } from "../dto/graph.dto";
import type { PageParams, Paginated } from "../../../shared/types/pagination.types";

// Ventana de pedidos que forman el grafo: el último año (menos filas escaneadas, relaciones vigentes)
const WINDOW = Prisma.sql`o."placedAt" > now() - interval '365 days' AND o.status <> 'CANCELLED'`;

export interface WeightedId {
  productId: string;
  weight: number;
}

export class GraphRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // purchasedTogether => productos que aparecen en los MISMOS pedidos que las semillas (co-compra).
  // La reutiliza el módulo Recommendation (DRY: una sola consulta de co-compra en el sistema).
  public async purchasedTogether(productIds: string[], limit: number): Promise<WeightedId[]> {
    if (productIds.length === 0) return [];
    // "::int" => COUNT devuelve bigint en Postgres; se convierte para recibir number (no BigInt) en JS
    return this.prisma.$queryRaw<WeightedId[]>`
      SELECT b."productId" AS "productId", COUNT(DISTINCT b."orderId")::int AS weight
      FROM order_items a
      JOIN order_items b ON b."orderId" = a."orderId" AND b."productId" <> a."productId"
      JOIN orders o ON o.id = a."orderId"
      WHERE a."productId" = ANY(${productIds}::text[]) AND ${WINDOW}
      GROUP BY b."productId"
      ORDER BY weight DESC
      LIMIT ${limit}`;
  }

  // coPurchaseEdges => aristas producto-producto con su peso (pedidos en común) para detectar clústeres.
  // "a < b" => cada par se cuenta una sola vez (grafo no dirigido)
  public async coPurchaseEdges(minWeight: number, maxEdges: number): Promise<GraphEdgeDto[]> {
    return this.prisma.$queryRaw<GraphEdgeDto[]>`
      SELECT a."productId" AS source, b."productId" AS target, COUNT(DISTINCT a."orderId")::int AS weight
      FROM order_items a
      JOIN order_items b ON b."orderId" = a."orderId" AND a."productId" < b."productId"
      JOIN orders o ON o.id = a."orderId"
      WHERE ${WINDOW}
      GROUP BY a."productId", b."productId"
      HAVING COUNT(DISTINCT a."orderId") >= ${minWeight}
      ORDER BY weight DESC
      LIMIT ${maxEdges}`;
  }

  // related => misma marca, categoría o colección (relación de catálogo), mejor valorados primero
  public async related(productId: string, limit: number): Promise<string[]> {
    const base = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { brandId: true, categoryId: true, collections: { select: { collectionId: true } } },
    });
    if (!base) return [];
    // "OR" dinámico: solo se agregan las condiciones que el producto tiene (spread condicional)
    const or: Prisma.ProductWhereInput[] = [
      ...(base.brandId ? [{ brandId: base.brandId }] : []),
      ...(base.categoryId ? [{ categoryId: base.categoryId }] : []),
      ...(base.collections.length > 0 ? [{ collections: { some: { collectionId: { in: base.collections.map((c) => c.collectionId) } } } }] : []),
    ];
    if (or.length === 0) return [];
    const rows = await this.prisma.product.findMany({
      where: { id: { not: productId }, status: "ACTIVE", OR: or },
      orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
      take: limit,
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  // similar => misma categoría y precio dentro de ±30 % (sustitutos), el más cercano en precio primero
  public async similar(productId: string, limit: number): Promise<string[]> {
    const base = await this.prisma.product.findUnique({ where: { id: productId }, select: { categoryId: true, minPriceCents: true } });
    if (!base?.categoryId) return [];
    const low = Math.floor(base.minPriceCents * 0.7);
    const high = Math.ceil(base.minPriceCents * 1.3);
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM products
      WHERE "categoryId" = ${base.categoryId} AND id <> ${productId} AND status = 'ACTIVE'
        AND "minPriceCents" BETWEEN ${low} AND ${high}
      ORDER BY abs("minPriceCents" - ${base.minPriceCents}), "ratingAvg" DESC
      LIMIT ${limit}`;
    return rows.map((row) => row.id);
  }

  // nodes => nodos del grafo a partir de las tarjetas del catálogo (solo productos activos)
  public async nodes(productIds: string[], groups?: ReadonlyMap<string, number>): Promise<GraphNodeDto[]> {
    const cards = await productRepository.findCardsByIds([...new Set(productIds)]);
    return cards.map((card) => ({ id: card.id, name: card.name, slug: card.slug, group: groups?.get(card.id) ?? 0 }));
  }

  // --- Resultados guardados (MongoDB) ---

  public async saveResult(input: Omit<GraphQueryDto, "id" | "createdAt"> & { createdBy: string }): Promise<GraphQueryDto> {
    return toDto(await GraphResultModel.create(input));
  }

  public async findResults(page: PageParams): Promise<Paginated<GraphQueryDto>> {
    const [docs, total] = await Promise.all([
      // Listado SIN nodos ni aristas ("select" negativo): la lista pesa poco; el detalle se pide aparte
      GraphResultModel.find().sort({ createdAt: -1 }).skip(page.skip).limit(page.limit).select({ nodes: 0, edges: 0 }).lean(),
      GraphResultModel.countDocuments(),
    ]);
    return { items: docs.map(toDto), total };
  }

  public async deleteResult(id: string): Promise<boolean> {
    return (await GraphResultModel.deleteOne({ _id: id })).deletedCount > 0;
  }
}

// toDto => documento Mongo -> DTO (ObjectId expuesto como string "id")
function toDto(doc: {
  _id: unknown;
  queryType: string;
  params?: unknown;
  nodes?: readonly GraphNodeDto[] | null | undefined;
  edges?: readonly GraphEdgeDto[] | null | undefined;
  summary?: string | null | undefined;
  durationMs?: number | null | undefined;
  createdAt?: Date | undefined;
}): GraphQueryDto {
  return {
    id: String(doc._id),
    queryType: doc.queryType as GraphQueryType,
    params: (doc.params ?? {}) as Record<string, unknown>,
    nodes: (doc.nodes ?? []).map(({ id, name, slug, group }) => ({ id, name, slug, group })),
    edges: (doc.edges ?? []).map(({ source, target, weight }) => ({ source, target, weight })),
    summary: doc.summary ?? null,
    durationMs: doc.durationMs ?? 0,
    createdAt: doc.createdAt ?? new Date(),
  };
}

export const graphRepository = new GraphRepository(prisma);
