// email.repository.ts => historial de envíos y plantillas en MongoDB (Mongoose). Patrón Repository.
import { Types, type FilterQuery } from "mongoose";
import { EmailLogModel, EmailTemplateModel, type EmailLogRecord, type EmailStatus, type EmailTemplateRecord } from "../model/email.model";
import type { EmailLogDto, EmailTemplateDto } from "../dto/email.dto";
import type { ListEmailsQuery } from "../schema/email.schema";
import type { PageParams, Paginated } from "../../../shared/types/pagination.types";

export type NewEmailLog = Pick<EmailLogDto, "to" | "subject" | "templateId" | "campaignId" | "sentBy"> & { variant?: "A" | "B" | null };
export type TemplateWrite = Partial<Pick<EmailTemplateDto, "name" | "subject" | "html" | "text" | "variables" | "locale" | "blocks">>;
// CampaignStats => métricas por campaña (y por variante A/B)
export interface CampaignStats {
  sent: number;
  failed: number;
  opened: number;
  clicked: number;
  converted: number;
  revenueCents: number;
}
const EMPTY: CampaignStats = { sent: 0, failed: 0, opened: 0, clicked: 0, converted: 0, revenueCents: 0 };

export class EmailRepository {
  // queueMany => registra los envíos en estado QUEUED en UNA escritura (insertMany) y devuelve sus IDs
  public async queueMany(entries: NewEmailLog[]): Promise<EmailLogDto[]> {
    return (await EmailLogModel.insertMany(entries)).map((doc) => toLog(doc.toObject()));
  }

  public async markSent(id: string): Promise<void> {
    await EmailLogModel.updateOne({ _id: id }, { $set: { status: "SENT", sentAt: new Date() } });
  }

  public async markFailed(id: string, error: string): Promise<void> {
    await EmailLogModel.updateOne({ _id: id }, { $set: { status: "FAILED", error } });
  }

  // registerOpen => "$inc" atómico del contador + primera fecha de apertura (solo si aún es null)
  public async registerOpen(id: string): Promise<void> {
    await EmailLogModel.updateOne({ _id: id }, [{ $set: { openCount: { $add: ["$openCount", 1] }, openedAt: { $ifNull: ["$openedAt", "$$NOW"] } } }]);
  }

  // registerClick => RF-21.5 contador de clics + primera fecha (pipeline de actualización atómico)
  public async registerClick(id: string): Promise<void> {
    await EmailLogModel.updateOne({ _id: id }, [{ $set: { clickCount: { $add: ["$clickCount", 1] }, clickedAt: "$$NOW", openedAt: { $ifNull: ["$openedAt", "$$NOW"] }, openCount: { $max: ["$openCount", 1] } } }]);
  }

  // attributeConversion => la compra se atribuye al ÚLTIMO correo de campaña en el que el cliente hizo clic (7 días)
  public async attributeConversion(email: string, revenueCents: number, since: Date): Promise<boolean> {
    const doc = await EmailLogModel.findOneAndUpdate(
      { to: email.toLowerCase(), campaignId: { $ne: null }, clickedAt: { $gte: since }, convertedAt: null },
      { $set: { convertedAt: new Date(), revenueCents } },
      { sort: { clickedAt: -1 } }
    ).lean();
    return Boolean(doc);
  }

  // sentEmails => destinatarios que ya recibieron la campaña (la variante ganadora no se repite a nadie)
  public async sentEmails(campaignId: string): Promise<Set<string>> {
    return new Set(await EmailLogModel.distinct("to", { campaignId: new Types.ObjectId(campaignId) }));
  }

  // variantStats => RF-21.4 resultados por variante de la prueba A/B
  public async variantStats(campaignId: string): Promise<Record<"A" | "B", CampaignStats>> {
    const rows = await this.aggregateStats({ campaignId: new Types.ObjectId(campaignId), variant: { $in: ["A", "B"] } }, "$variant");
    return { A: rows.get("A") ?? EMPTY, B: rows.get("B") ?? EMPTY };
  }

  public async findMany(filters: Omit<ListEmailsQuery, "page" | "limit">, page: PageParams): Promise<Paginated<EmailLogDto>> {
    const where: FilterQuery<EmailLogRecord> = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.to ? { to: filters.to } : {}),
      ...(filters.campaignId ? { campaignId: new Types.ObjectId(filters.campaignId) } : {}),
    };
    const [docs, total] = await Promise.all([EmailLogModel.find(where).sort({ createdAt: -1 }).skip(page.skip).limit(page.limit).lean(), EmailLogModel.countDocuments(where)]);
    return { items: docs.map(toLog), total };
  }

  public async findById(id: string): Promise<EmailLogDto | null> {
    const doc = await EmailLogModel.findById(id).lean();
    return doc ? toLog(doc) : null;
  }

  // campaignStats => métricas de una o varias campañas en UNA agregación (enviados, abiertos, clics, conversiones)
  public async campaignStats(campaignIds: string[]): Promise<Map<string, CampaignStats>> {
    if (campaignIds.length === 0) return new Map();
    return this.aggregateStats({ campaignId: { $in: campaignIds.map((id) => new Types.ObjectId(id)) } }, "$campaignId");
  }

  // aggregateStats => agregación común (DRY entre campaña y variante): $group por la clave pedida
  private async aggregateStats(match: FilterQuery<EmailLogRecord>, key: string): Promise<Map<string, CampaignStats>> {
    const rows = await EmailLogModel.aggregate<CampaignStats & { _id: unknown }>([
      { $match: match },
      {
        $group: {
          _id: key,
          sent: { $sum: { $cond: [{ $eq: ["$status", "SENT"] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] } },
          opened: { $sum: { $cond: [{ $gt: ["$openCount", 0] }, 1, 0] } },
          clicked: { $sum: { $cond: [{ $gt: ["$clickCount", 0] }, 1, 0] } },
          converted: { $sum: { $cond: [{ $ne: ["$convertedAt", null] }, 1, 0] } },
          revenueCents: { $sum: "$revenueCents" },
        },
      },
    ]);
    return new Map(rows.map(({ _id, ...stats }) => [String(_id), stats]));
  }

  // --- Plantillas ---

  public async createTemplate(data: Required<Omit<TemplateWrite, "text">> & { text: string | null; createdBy: string }): Promise<EmailTemplateDto> {
    return toTemplate((await EmailTemplateModel.create(data)).toObject());
  }

  public async findTemplates(): Promise<EmailTemplateDto[]> {
    return (await EmailTemplateModel.find().sort({ name: 1 }).limit(200).lean()).map(toTemplate);
  }

  public async findTemplate(id: string): Promise<EmailTemplateDto | null> {
    const doc = await EmailTemplateModel.findById(id).lean();
    return doc ? toTemplate(doc) : null;
  }

  public async findTemplateByName(name: string): Promise<EmailTemplateDto | null> {
    const doc = await EmailTemplateModel.findOne({ name }).lean();
    return doc ? toTemplate(doc) : null;
  }

  public async updateTemplate(id: string, changes: TemplateWrite): Promise<EmailTemplateDto | null> {
    const doc = await EmailTemplateModel.findByIdAndUpdate(id, { $set: changes }, { new: true }).lean();
    return doc ? toTemplate(doc) : null;
  }

  public async deleteTemplate(id: string): Promise<boolean> {
    return (await EmailTemplateModel.deleteOne({ _id: id })).deletedCount === 1;
  }
}

function toLog(doc: Partial<EmailLogRecord> & { _id: unknown; createdAt?: Date }): EmailLogDto {
  return {
    id: String(doc._id),
    to: doc.to ?? "",
    subject: doc.subject ?? "",
    templateId: doc.templateId ? String(doc.templateId) : null,
    campaignId: doc.campaignId ? String(doc.campaignId) : null,
    status: (doc.status ?? "QUEUED") as EmailStatus,
    error: doc.error ?? null,
    sentBy: doc.sentBy ?? null,
    openCount: doc.openCount ?? 0,
    openedAt: doc.openedAt ?? null,
    clickCount: doc.clickCount ?? 0,
    convertedAt: doc.convertedAt ?? null,
    revenueCents: doc.revenueCents ?? 0,
    variant: (doc.variant ?? null) as "A" | "B" | null,
    sentAt: doc.sentAt ?? null,
    createdAt: doc.createdAt ?? new Date(),
  };
}

function toTemplate(doc: Partial<EmailTemplateRecord> & { _id: unknown; createdAt?: Date; updatedAt?: Date }): EmailTemplateDto {
  return {
    id: String(doc._id),
    name: doc.name ?? "",
    subject: doc.subject ?? "",
    html: doc.html ?? "",
    text: doc.text ?? null,
    variables: doc.variables ?? [],
    blocks: (doc.blocks as unknown[] | null | undefined) ?? null,
    locale: (doc.locale ?? "es") as "es" | "en",
    createdBy: doc.createdBy ?? "",
    createdAt: doc.createdAt ?? new Date(),
    updatedAt: doc.updatedAt ?? new Date(),
  };
}

export const emailRepository = new EmailRepository();
