// webhook.repository.ts => endpoints registrados y bitácora de entregas en MongoDB (Mongoose). Patrón Repository.
import { Types } from "mongoose";
import { WebhookDeliveryModel, WebhookModel, type DeliveryStatus, type WebhookEvent, type WebhookRecord } from "../model/webhook.model";
import type { DeliveryMetricsDto, ExecutionDto, WebhookDto } from "../dto/webhook.dto";
import type { PageParams, Paginated } from "../../../shared/types/pagination.types";

export type WebhookRow = Omit<WebhookDto, "metrics">;
export type WebhookTarget = Pick<WebhookRow, "id" | "url" | "maxAttempts"> & { secret: string }; // Lo que necesita el despachador
export type WebhookWrite = Partial<Pick<WebhookRow, "name" | "url" | "events" | "active" | "maxAttempts">> & { secret?: string };

const METRICS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
export const EMPTY_METRICS: DeliveryMetricsDto = { deliveries: 0, successRate: 0, avgDurationMs: 0 };

export class WebhookRepository {
  public async create(data: Required<Omit<WebhookWrite, "secret">> & { secret: string; createdBy: string }): Promise<WebhookRow> {
    return toRow((await WebhookModel.create(data)).toObject());
  }

  public async findMany(page: PageParams): Promise<Paginated<WebhookRow>> {
    const [docs, total] = await Promise.all([WebhookModel.find().sort({ createdAt: -1 }).skip(page.skip).limit(page.limit).lean(), WebhookModel.countDocuments()]);
    return { items: docs.map(toRow), total };
  }

  public async findById(id: string): Promise<WebhookRow | null> {
    const doc = await WebhookModel.findById(id).lean();
    return doc ? toRow(doc) : null;
  }

  // findTargets => endpoints activos suscritos al evento, CON el secreto ("+secret" anula el select: false)
  public async findTargets(event: WebhookEvent, id?: string): Promise<WebhookTarget[]> {
    const filter = id ? { _id: id } : { active: true, events: event };
    const docs = await WebhookModel.find(filter).select("+secret url maxAttempts").lean();
    return docs.map((doc) => ({ id: String(doc._id), url: doc.url, maxAttempts: doc.maxAttempts ?? 5, secret: doc.secret }));
  }

  public async update(id: string, changes: WebhookWrite): Promise<WebhookRow | null> {
    const doc = await WebhookModel.findByIdAndUpdate(id, { $set: changes }, { new: true }).lean();
    return doc ? toRow(doc) : null;
  }

  // delete => el endpoint y su bitácora
  public async delete(id: string): Promise<boolean> {
    const [result] = await Promise.all([WebhookModel.deleteOne({ _id: id }), WebhookDeliveryModel.deleteMany({ webhookId: id })]);
    return result.deletedCount === 1;
  }

  public async createDelivery(webhookId: string, event: string): Promise<ExecutionDto> {
    return toDelivery((await WebhookDeliveryModel.create({ webhookId, event })).toObject());
  }

  // finishDelivery => cierra la entrega y marca la última entrega del endpoint (dos escrituras en paralelo)
  public async finishDelivery(delivery: ExecutionDto, result: { status: DeliveryStatus; attempts: number; httpStatus: number | null; durationMs: number; error: string | null }): Promise<ExecutionDto> {
    const deliveredAt = result.status === "SUCCESS" ? new Date() : null;
    await Promise.all([
      WebhookDeliveryModel.updateOne({ _id: delivery.id }, { $set: { ...result, deliveredAt } }),
      WebhookModel.updateOne({ _id: delivery.webhookId }, { $set: { lastDeliveryAt: new Date() } }),
    ]);
    return { ...delivery, ...result, deliveredAt };
  }

  // metrics => UNA agregación para todos los endpoints de la página (sin N+1)
  public async metrics(webhookIds: string[]): Promise<Map<string, DeliveryMetricsDto>> {
    if (webhookIds.length === 0) return new Map();
    const rows = await WebhookDeliveryModel.aggregate<{ _id: Types.ObjectId; total: number; ok: number; avg: number | null }>([
      { $match: { webhookId: { $in: webhookIds.map((id) => new Types.ObjectId(id)) }, createdAt: { $gte: new Date(Date.now() - METRICS_WINDOW_MS) } } },
      { $group: { _id: "$webhookId", total: { $sum: 1 }, ok: { $sum: { $cond: [{ $eq: ["$status", "SUCCESS"] }, 1, 0] } }, avg: { $avg: "$durationMs" } } },
    ]);
    return new Map(rows.map((row) => [String(row._id), { deliveries: row.total, successRate: row.total > 0 ? Number((row.ok / row.total).toFixed(4)) : 0, avgDurationMs: Math.round(row.avg ?? 0) }]));
  }
}

function toRow(doc: Partial<WebhookRecord> & { _id: unknown; createdAt?: Date; updatedAt?: Date }): WebhookRow {
  return {
    id: String(doc._id),
    name: doc.name ?? "",
    url: doc.url ?? "",
    events: (doc.events ?? []) as WebhookEvent[],
    active: doc.active ?? true,
    maxAttempts: doc.maxAttempts ?? 5,
    lastDeliveryAt: doc.lastDeliveryAt ?? null,
    createdAt: doc.createdAt ?? new Date(),
    updatedAt: doc.updatedAt ?? new Date(),
  };
}

function toDelivery(doc: { _id: unknown; webhookId: unknown; event: string; status?: string | null; attempts?: number | null; httpStatus?: number | null; durationMs?: number | null; error?: string | null; createdAt?: Date; deliveredAt?: Date | null }): ExecutionDto {
  return {
    id: String(doc._id),
    webhookId: String(doc.webhookId),
    event: doc.event,
    status: (doc.status ?? "PENDING") as DeliveryStatus,
    attempts: doc.attempts ?? 0,
    httpStatus: doc.httpStatus ?? null,
    durationMs: doc.durationMs ?? 0,
    error: doc.error ?? null,
    createdAt: doc.createdAt ?? new Date(),
    deliveredAt: doc.deliveredAt ?? null,
  };
}

export const webhookRepository = new WebhookRepository();
