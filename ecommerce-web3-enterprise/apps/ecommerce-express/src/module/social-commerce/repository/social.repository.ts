// social.repository.ts => publicaciones en MongoDB (Mongoose) + validación de productos etiquetados en PostgreSQL (Prisma).
import type { PrismaClient } from "@prisma/client";
import type { PipelineStage } from "mongoose";
import { prisma } from "../../../config/database.config";
import { SocialPostModel, type SocialPlatform, type SocialPostStatus, type SocialFormat } from "../model/social.model";
import type { InfluencerDto, SocialAnalyticDto, SocialMetricsDto } from "../dto/social.dto";
import type { PageParams, Paginated } from "../../../shared/types/pagination.types";
import type { PartialUpdate } from "../../../shared/types/common.types";

// SocialPostRow => documento plano (productos sin hidratar: el service arma las tarjetas en lote)
export interface SocialPostRow {
  id: string;
  authorId: string;
  caption: string;
  mediaUrl: string;
  mediaAlt: string;
  productIds: string[];
  platforms: SocialPlatform[];
  format: SocialFormat; // RF-19.8
  linkUrl: string | null;
  status: SocialPostStatus;
  influencer: InfluencerDto | null;
  referralCode: string | null;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  externalIds: Record<string, string>;
  error: string | null;
  metrics: SocialMetricsDto;
  createdAt: Date;
}

// Campos que el service puede escribir (sin id ni fechas automáticas). "PartialUpdate" acepta undefined (campos
// opcionales de Zod); Mongoose los omite al guardar
export type SocialPostWrite = PartialUpdate<Omit<SocialPostRow, "id" | "createdAt" | "metrics">>;

const METRIC_KEYS = ["impressions", "clicks", "likes", "comments", "purchases"] as const;

export class SocialRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async create(data: SocialPostWrite & Pick<SocialPostRow, "authorId" | "caption" | "mediaUrl" | "mediaAlt">): Promise<SocialPostRow> {
    return toRow(await SocialPostModel.create(data));
  }

  public async findById(id: string): Promise<SocialPostRow | null> {
    const doc = await SocialPostModel.findById(id).lean();
    return doc ? toRow(doc) : null;
  }

  // findPublished => feed público paginado (solo PUBLISHED), filtrable por influencer o producto etiquetado
  public async findPublished(filter: { influencer?: string | undefined; productId?: string | undefined }, page: PageParams): Promise<Paginated<SocialPostRow>> {
    const where = {
      status: "PUBLISHED",
      ...(filter.influencer ? { "influencer.handle": filter.influencer } : {}),
      ...(filter.productId ? { productIds: filter.productId } : {}), // En arreglos, igualdad = "contiene"
    };
    const [docs, total] = await Promise.all([
      SocialPostModel.find(where).sort({ publishedAt: -1 }).skip(page.skip).limit(page.limit).lean(),
      SocialPostModel.countDocuments(where),
    ]);
    return { items: docs.map(toRow), total };
  }

  // update => "$set" parcial; "new: true" devuelve el documento ya actualizado
  public async update(id: string, changes: SocialPostWrite): Promise<SocialPostRow | null> {
    const doc = await SocialPostModel.findByIdAndUpdate(id, { $set: changes }, { new: true }).lean();
    return doc ? toRow(doc) : null;
  }

  public async delete(id: string): Promise<void> {
    await SocialPostModel.deleteOne({ _id: id });
  }

  // claimDueScheduled => toma UNA publicación programada vencida y la marca PUBLISHING en una operación atómica
  // ("findOneAndUpdate"): si hay varias réplicas, cada publicación la procesa solo una (sin duplicados en redes).
  public async claimDueScheduled(now: Date): Promise<SocialPostRow | null> {
    const doc = await SocialPostModel.findOneAndUpdate(
      { status: "SCHEDULED", scheduledAt: { $lte: now } },
      { $set: { status: "PUBLISHING" } },
      { new: true, sort: { scheduledAt: 1 } }
    ).lean();
    return doc ? toRow(doc) : null;
  }

  // analytics => métricas sumadas por red con UNA agregación ($facet ejecuta dos pipelines sobre los mismos datos).
  // Las métricas se guardan por publicación: en las filas por red se suman las de cada publicación que salió en ella.
  public async analytics(authorId?: string): Promise<SocialAnalyticDto[]> {
    const sums = Object.fromEntries(METRIC_KEYS.map((key) => [key, { $sum: `$metrics.${key}` }]));
    const match: PipelineStage.Match = { $match: { status: "PUBLISHED", ...(authorId ? { authorId } : {}) } };
    const [result] = await SocialPostModel.aggregate<{ store: Array<Record<string, number>>; byPlatform: Array<Record<string, number | string>> }>([
      match,
      {
        $facet: {
          store: [{ $group: { _id: null, posts: { $sum: 1 }, ...sums } }],
          byPlatform: [{ $unwind: "$platforms" }, { $group: { _id: "$platforms", posts: { $sum: 1 }, ...sums } }],
        },
      },
    ]);
    const rows: Array<Record<string, unknown>> = [...(result?.store ?? []).map((row) => ({ ...row, _id: "STORE" })), ...(result?.byPlatform ?? [])];
    return rows.map((row) => {
      const metrics = Object.fromEntries(METRIC_KEYS.map((key) => [key, Number(row[key] ?? 0)])) as unknown as SocialMetricsDto;
      return { platform: row["_id"] as SocialAnalyticDto["platform"], posts: Number(row["posts"] ?? 0), ...metrics, ctr: metrics.impressions > 0 ? Number((metrics.clicks / metrics.impressions).toFixed(4)) : 0 };
    });
  }

  // ownedActiveProducts => cuáles de los IDs existen, están activos y (si aplica) pertenecen al vendedor
  public async ownedActiveProducts(ids: string[], vendorId?: string): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await this.prisma.product.findMany({ where: { id: { in: ids }, status: "ACTIVE", ...(vendorId ? { vendorId } : {}) }, select: { id: true } });
    return new Set(rows.map((row) => row.id));
  }
}

// Forma mínima del documento lean que se convierte (tipado local, sin "any")
interface SocialDoc {
  _id: unknown;
  authorId: string;
  caption: string;
  mediaUrl: string;
  mediaAlt: string;
  productIds?: string[] | null | undefined;
  platforms?: string[] | null | undefined;
  format?: string | null | undefined;
  linkUrl?: string | null | undefined;
  status?: string | null | undefined;
  influencer?: { handle: string; displayName: string; avatarUrl?: string | null | undefined } | null | undefined;
  referralCode?: string | null | undefined;
  scheduledAt?: Date | null | undefined;
  publishedAt?: Date | null | undefined;
  externalIds?: Map<string, string> | Record<string, string> | null | undefined;
  error?: string | null | undefined;
  metrics?: Partial<SocialMetricsDto> | null | undefined;
  createdAt?: Date | undefined;
}

function toRow(doc: SocialDoc): SocialPostRow {
  const metrics = doc.metrics ?? {};
  return {
    id: String(doc._id),
    authorId: doc.authorId,
    caption: doc.caption,
    mediaUrl: doc.mediaUrl,
    mediaAlt: doc.mediaAlt,
    productIds: doc.productIds ?? [],
    platforms: (doc.platforms ?? []) as SocialPlatform[],
    format: (doc.format ?? "FEED") as SocialFormat,
    linkUrl: doc.linkUrl ?? null,
    status: (doc.status ?? "DRAFT") as SocialPostStatus,
    influencer: doc.influencer ? { handle: doc.influencer.handle, displayName: doc.influencer.displayName, avatarUrl: doc.influencer.avatarUrl ?? null } : null,
    referralCode: doc.referralCode ?? null,
    scheduledAt: doc.scheduledAt ?? null,
    publishedAt: doc.publishedAt ?? null,
    // "Map" (documento hidratado) u objeto plano (lean): se normaliza a objeto
    externalIds: doc.externalIds instanceof Map ? Object.fromEntries(doc.externalIds) : { ...(doc.externalIds ?? {}) },
    error: doc.error ?? null,
    metrics: Object.fromEntries(METRIC_KEYS.map((key) => [key, metrics[key] ?? 0])) as unknown as SocialMetricsDto,
    createdAt: doc.createdAt ?? new Date(),
  };
}

export const socialRepository = new SocialRepository(prisma);
