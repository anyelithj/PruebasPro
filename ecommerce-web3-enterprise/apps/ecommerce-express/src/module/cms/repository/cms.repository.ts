// cms.repository.ts => acceso a MongoDB (Mongoose) del módulo CMS. Patrón Repository: el service no conoce Mongoose.
// Listados con proyección (sin body/proyecto GrapesJS) => documentos pequeños: menos RAM, red y CPU de serialización.
import type { FilterQuery } from "mongoose";
import { CmsContentModel, CmsLeadModel, StoreConfigModel, type ConfigSection, type ContentKind, type ContentRecord, type ContentStatus } from "../model/cms.model";
import type { CmsContentDto, CmsContentSummaryDto, CmsLeadDto, CmsMediaDto, StoreConfigDto } from "../dto/cms.dto";
import type { ContentInput, ListContentQuery, UpdateContentInput } from "../schema/cms.schema";
import type { PageParams, Paginated } from "../../../shared/types/pagination.types";

// "interface Doc" => forma "lean" (objeto plano) que devuelve Mongoose; "_id" llega como ObjectId.
// Se declara a mano (no InferSchemaType) porque los subdocumentos "lean" son objetos planos, no Subdocument.
type Maybe<T> = T | null | undefined;
interface Doc {
  _id: unknown;
  kind?: Maybe<string>;
  slug?: Maybe<string>;
  title?: Maybe<string>;
  summary?: Maybe<string>;
  locale?: Maybe<string>;
  status?: Maybe<string>;
  seo?: Maybe<{ title?: Maybe<string>; description?: Maybe<string>; imageUrl?: Maybe<string> }>;
  body?: Maybe<{ html?: Maybe<string>; css?: Maybe<string>; project?: unknown }>;
  media?: Maybe<Array<{ url: string; publicId?: Maybe<string>; alt: string; width?: Maybe<number>; height?: Maybe<number>; hotspots?: Maybe<Array<{ productId: string; x?: Maybe<number>; y?: Maybe<number> }>> }>>;
  productIds?: Maybe<string[]>;
  data?: unknown;
  publishedAt?: Maybe<Date>;
  createdBy?: Maybe<string>;
  createdAt?: Maybe<Date>;
  updatedAt?: Maybe<Date>;
}
const SUMMARY = { body: 0, seo: 0, productIds: 0 } as const; // Proyección: campos que el listado no necesita

// isDuplicate => error 11000 de MongoDB (índice único violado) sin depender de la clase interna del driver
export const isDuplicate = (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === 11000;

export class CmsRepository {
  public async create(kind: ContentKind, input: ContentInput, createdBy: string): Promise<CmsContentDto> {
    const publishedAt = input.status === "PUBLISHED" ? new Date() : null;
    return toDto((await CmsContentModel.create({ ...input, kind, createdBy, publishedAt })).toObject());
  }

  public async findMany(kind: ContentKind, filters: Omit<ListContentQuery, "page" | "limit">, page: PageParams): Promise<Paginated<CmsContentSummaryDto>> {
    const where: FilterQuery<ContentRecord> = { kind, status: filters.status ?? { $ne: "ARCHIVED" } };
    if (filters.locale) where.locale = filters.locale;
    // Búsqueda por título sin índice de texto (volumen editorial pequeño); se escapan los caracteres de regex
    if (filters.q) where.title = { $regex: filters.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    if (filters.upcoming) where["data.endsAt"] = { $gte: new Date() };
    const sort = kind === "event" ? { "data.startsAt": 1 as const } : { publishedAt: -1 as const, updatedAt: -1 as const };
    const [docs, total] = await Promise.all([CmsContentModel.find(where, SUMMARY).sort(sort).skip(page.skip).limit(page.limit).lean(), CmsContentModel.countDocuments(where)]);
    return { items: docs.map(toSummary), total };
  }

  public async findBySlug(kind: ContentKind, slug: string): Promise<CmsContentDto | null> {
    const doc = await CmsContentModel.findOne({ kind, slug }).lean();
    return doc ? toDto(doc) : null;
  }

  public async findById(kind: ContentKind, id: string): Promise<CmsContentDto | null> {
    const doc = await CmsContentModel.findOne({ _id: id, kind }).lean();
    return doc ? toDto(doc) : null;
  }

  // update => "$set" parcial; publishedAt se fija la PRIMERA vez que pasa a PUBLISHED (fecha real de publicación)
  public async update(kind: ContentKind, id: string, input: UpdateContentInput, current: ContentStatus): Promise<CmsContentDto | null> {
    const publishedAt = input.status === "PUBLISHED" && current !== "PUBLISHED" ? { publishedAt: new Date() } : {};
    const doc = await CmsContentModel.findOneAndUpdate({ _id: id, kind }, { $set: { ...input, ...publishedAt } }, { new: true, runValidators: true }).lean();
    return doc ? toDto(doc) : null;
  }

  // ---------- Leads ----------
  public async createLead(landingSlug: string, input: { email: string; name?: string | undefined; consent: true; source?: string | undefined }): Promise<CmsLeadDto> {
    return toLead((await CmsLeadModel.create({ ...input, landingSlug })).toObject());
  }

  public async findLeads(landing: string | undefined, page: PageParams): Promise<Paginated<CmsLeadDto>> {
    const where = landing ? { landingSlug: landing } : {};
    const [docs, total] = await Promise.all([CmsLeadModel.find(where).sort({ createdAt: -1 }).skip(page.skip).limit(page.limit).lean(), CmsLeadModel.countDocuments(where)]);
    return { items: docs.map(toLead), total };
  }

  // ---------- Configuración de tienda ----------
  public async findConfig(): Promise<StoreConfigDto[]> {
    return (await StoreConfigModel.find().lean()).map((doc) => ({ section: doc.section as ConfigSection, value: doc.value as Record<string, unknown>, updatedAt: doc.updatedAt ?? null }));
  }

  // upsert => crea la sección la primera vez o la reemplaza (una sola operación atómica)
  public async saveConfig(section: ConfigSection, value: Record<string, unknown>, updatedBy: string): Promise<StoreConfigDto> {
    const doc = await StoreConfigModel.findOneAndUpdate({ section }, { $set: { value, updatedBy } }, { upsert: true, new: true }).lean();
    return { section, value: doc?.value as Record<string, unknown>, updatedAt: doc?.updatedAt ?? new Date() };
  }
}

// ---------- Mappers (funciones puras: documento Mongo -> DTO) ----------
function toMedia(media: Doc["media"]): CmsMediaDto[] {
  return (media ?? []).map((item) => ({
    url: item.url,
    publicId: item.publicId ?? null,
    alt: item.alt,
    width: item.width ?? null,
    height: item.height ?? null,
    hotspots: (item.hotspots ?? []).map((spot) => ({ productId: spot.productId, x: spot.x ?? 50, y: spot.y ?? 50 })),
  }));
}

function toSummary(doc: Doc): CmsContentSummaryDto {
  const cover = doc.media?.[0];
  return {
    id: String(doc._id),
    kind: doc.kind as ContentKind,
    slug: doc.slug ?? "",
    title: doc.title ?? "",
    summary: doc.summary ?? "",
    locale: (doc.locale ?? "es") as "es" | "en",
    status: (doc.status ?? "DRAFT") as ContentStatus,
    coverUrl: cover?.url ?? null,
    coverAlt: cover?.alt ?? null,
    data: (doc.data ?? {}) as Record<string, unknown>,
    publishedAt: doc.publishedAt ?? null,
    updatedAt: doc.updatedAt ?? new Date(),
  };
}

function toDto(doc: Doc): CmsContentDto {
  const { coverUrl: _coverUrl, coverAlt: _coverAlt, ...summary } = toSummary(doc);
  return {
    ...summary,
    seo: { title: doc.seo?.title ?? null, description: doc.seo?.description ?? null, imageUrl: doc.seo?.imageUrl ?? null },
    body: { html: doc.body?.html ?? "", css: doc.body?.css ?? "", project: (doc.body?.project ?? null) as Record<string, unknown> | null },
    media: toMedia(doc.media),
    productIds: doc.productIds ?? [],
    createdBy: doc.createdBy ?? "",
    createdAt: doc.createdAt ?? new Date(),
  };
}

function toLead(doc: { _id: unknown; landingSlug: string; email: string; name?: string | null; source?: string | null; createdAt?: Date }): CmsLeadDto {
  return { id: String(doc._id), landingSlug: doc.landingSlug, email: doc.email, name: doc.name ?? null, source: doc.source ?? null, createdAt: doc.createdAt ?? new Date() };
}

export const cmsRepository = new CmsRepository();
