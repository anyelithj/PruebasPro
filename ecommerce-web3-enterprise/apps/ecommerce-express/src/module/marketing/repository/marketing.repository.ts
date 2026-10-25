// marketing.repository.ts => campañas en MongoDB (Mongoose). Patrón Repository.
import type { FilterQuery } from "mongoose";
import { CampaignModel, type Audience, type CampaignRecord, type CampaignStatus, type Channel } from "../model/marketing.model";
import type { CampaignDto } from "../dto/marketing.dto";
import type { ListCampaignsQuery } from "../schema/marketing.schema";
import type { PageParams, Paginated } from "../../../shared/types/pagination.types";

export type CampaignRow = Omit<CampaignDto, "metrics"> & { metrics: { targeted: number; sent: number; failed: number } };
export type CampaignWrite = Partial<Pick<CampaignRow, "name" | "channel" | "audience" | "subject" | "content" | "templateId" | "url" | "status" | "scheduledAt" | "error" | "costCents" | "abTest">>;

export class MarketingRepository {
  public async create(data: CampaignWrite & Pick<CampaignRow, "name" | "channel" | "subject" | "content" | "createdBy">): Promise<CampaignRow> {
    return toRow((await CampaignModel.create(data)).toObject());
  }

  public async findMany(filters: Omit<ListCampaignsQuery, "page" | "limit">, page: PageParams): Promise<Paginated<CampaignRow>> {
    // Por defecto se ocultan las archivadas (aparecen solo si se piden con status=ARCHIVED)
    const where: FilterQuery<CampaignRecord> = { status: filters.status ?? { $ne: "ARCHIVED" }, ...(filters.channel ? { channel: filters.channel } : {}) };
    const [docs, total] = await Promise.all([CampaignModel.find(where).sort({ createdAt: -1 }).skip(page.skip).limit(page.limit).lean(), CampaignModel.countDocuments(where)]);
    return { items: docs.map(toRow), total };
  }

  public async findById(id: string): Promise<CampaignRow | null> {
    const doc = await CampaignModel.findById(id).lean();
    return doc ? toRow(doc) : null;
  }

  // update => "$set" condicionado a los estados editables (evita editar una campaña que justo empezó a enviarse)
  public async update(id: string, changes: CampaignWrite, allowed: CampaignStatus[]): Promise<CampaignRow | null> {
    const doc = await CampaignModel.findOneAndUpdate({ _id: id, status: { $in: allowed } }, { $set: changes }, { new: true }).lean();
    return doc ? toRow(doc) : null;
  }

  // claim => toma la campaña para enviarla (DRAFT/SCHEDULED -> SENDING) de forma atómica: nunca se envía dos veces
  public async claim(id: string): Promise<CampaignRow | null> {
    const doc = await CampaignModel.findOneAndUpdate({ _id: id, status: { $in: ["DRAFT", "SCHEDULED"] } }, { $set: { status: "SENDING", error: null } }, { new: true }).lean();
    return doc ? toRow(doc) : null;
  }

  // dueIds => campañas programadas cuya hora llegó (consulta por índice {status, scheduledAt})
  public async dueIds(now: Date, limit = 10): Promise<string[]> {
    return (await CampaignModel.find({ status: "SCHEDULED", scheduledAt: { $lte: now } }, { _id: 1 }).limit(limit).lean()).map((doc) => String(doc._id));
  }

  // startTest => RF-21.4 la muestra ya se envió: queda en TESTING hasta "decideAt"
  public async startTest(id: string, decideAt: Date, metrics: { targeted: number; sent: number; failed: number }): Promise<void> {
    await CampaignModel.updateOne({ _id: id }, { $set: { status: "TESTING", "abTest.decideAt": decideAt, "metrics.targeted": metrics.targeted, "metrics.sent": metrics.sent, "metrics.failed": metrics.failed } });
  }

  // claimTestsToDecide => toma de forma atómica las pruebas vencidas (TESTING -> SENDING) para no decidir dos veces
  public async claimTestsToDecide(now: Date, limit = 5): Promise<CampaignRow[]> {
    const claimed: CampaignRow[] = [];
    for (let index = 0; index < limit; index += 1) {
      const doc = await CampaignModel.findOneAndUpdate({ status: "TESTING", "abTest.decideAt": { $lte: now } }, { $set: { status: "SENDING" } }, { new: true }).lean();
      if (!doc) break;
      claimed.push(toRow(doc));
    }
    return claimed;
  }

  public async setWinner(id: string, winner: "A" | "B"): Promise<void> {
    await CampaignModel.updateOne({ _id: id }, { $set: { "abTest.winner": winner } });
  }

  public async finish(id: string, result: { status: CampaignStatus; targeted: number; sent: number; failed: number; error: string | null }): Promise<void> {
    await CampaignModel.updateOne(
      { _id: id },
      { $set: { status: result.status, error: result.error, sentAt: new Date(), "metrics.targeted": result.targeted, "metrics.sent": result.sent, "metrics.failed": result.failed } }
    );
  }
}

function toRow(doc: Partial<CampaignRecord> & { _id: unknown; createdAt?: Date; updatedAt?: Date }): CampaignRow {
  return {
    id: String(doc._id),
    name: doc.name ?? "",
    channel: (doc.channel ?? "EMAIL") as Channel,
    audience: (doc.audience ?? "ALL") as Audience,
    subject: doc.subject ?? "",
    content: doc.content ?? "",
    templateId: doc.templateId ? String(doc.templateId) : null,
    url: doc.url ?? null,
    status: (doc.status ?? "DRAFT") as CampaignStatus,
    scheduledAt: doc.scheduledAt ?? null,
    sentAt: doc.sentAt ?? null,
    metrics: { targeted: doc.metrics?.targeted ?? 0, sent: doc.metrics?.sent ?? 0, failed: doc.metrics?.failed ?? 0 },
    costCents: doc.costCents ?? 0,
    abTest: doc.abTest ? { subjectB: doc.abTest.subjectB, contentB: doc.abTest.contentB ?? null, testPercent: doc.abTest.testPercent ?? 20, metric: (doc.abTest.metric ?? "OPEN") as "OPEN" | "CLICK", waitHours: doc.abTest.waitHours ?? 4, decideAt: doc.abTest.decideAt ?? null, winner: (doc.abTest.winner ?? null) as "A" | "B" | null } : null,
    error: doc.error ?? null,
    createdBy: doc.createdBy ?? "",
    createdAt: doc.createdAt ?? new Date(),
    updatedAt: doc.updatedAt ?? new Date(),
  };
}

export const marketingRepository = new MarketingRepository();
