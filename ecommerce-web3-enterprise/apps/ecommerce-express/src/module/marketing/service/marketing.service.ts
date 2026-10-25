// marketing.service.ts => campañas de marketing (sprint 7.2): audiencia por segmento del CRM (solo con opt-in de
// marketing, GDPR), canal Email / Push / WhatsApp, envío inmediato o programado y métricas de rendimiento.
// Patrones: Strategy (un ChannelSender por canal; agregar un canal = agregar una entrada: OCP), Factory (registro de
// estrategias), Template Method (todas las campañas siguen: reclamar -> audiencia -> enviar -> cerrar con métricas) y
// Observer (WhatsApp lo ejecuta n8n vía webhook: la tienda no integra la API de Meta directamente).
import axios from "axios";
import { marketingRepository, type CampaignRow, type CampaignWrite, type MarketingRepository } from "../repository/marketing.repository";
import { CampaignLockedException, CampaignNotFoundException } from "../exception/marketing.exception";
import type { CampaignDto } from "../dto/marketing.dto";
import type { CampaignInput, ListCampaignsQuery, UpdateCampaignInput } from "../schema/marketing.schema";
import type { CampaignStatus, Channel } from "../model/marketing.model";
import { crmService } from "../../crm/service/crm.service";
import type { AudienceMember } from "../../crm/dto/crm.dto";
import { emailService } from "../../email/service/email.service";
import { htmlToText } from "../../email/util/template.util";
import { notificationService } from "../../notification/service/notification.service";
import { appConfig } from "../../../config/app.config";
import { buildPaginationMeta, toPageParams } from "../../../shared/util/pagination.util";
import type { PaginationMeta } from "../../../shared/types/pagination.types";
import { logger } from "../../../shared/middleware/logger.middleware";
import { prisma } from "../../../config/database.config";
import { withUtm } from "../../email/util/blocks.util";
import { chooseWinner, splitAudience } from "../model/ab-test.model"; // RF-21.4

const AB_MIN_AUDIENCE = 20; // Con menos destinatarios la prueba no es concluyente: se envía la variante A a todos

const EDITABLE: CampaignStatus[] = ["DRAFT", "SCHEDULED", "FAILED"]; // FAILED se puede corregir y reintentar

// ChannelSender => contrato de cada estrategia de envío: devuelve cuántos se enviaron y cuántos fallaron
type ChannelSender = (campaign: CampaignRow, audience: AudienceMember[], variant?: "A" | "B") => Promise<{ sent: number; failed: number }>;

// SENDERS => registro de estrategias por canal (Factory por tabla: sin if/else por canal)
const SENDERS: Record<Channel, ChannelSender> = {
  // Email: personalizado por destinatario ("{{ firstName }}"), con historial y tracking de apertura del módulo Email
  // RF-21.4 "variant" B usa el asunto/contenido alterno; los clics se rastrean y llevan UTM (RF-21.5)
  EMAIL: (campaign, audience, variant) =>
    emailService.sendBulk(
      audience.map((member) => ({ to: member.email, variables: { firstName: member.firstName, lastName: member.lastName } })),
      variant === "B" && campaign.abTest ? { subject: campaign.abTest.subjectB, html: campaign.abTest.contentB ?? campaign.content } : { subject: campaign.subject, html: campaign.content },
      { campaignId: campaign.id, sentBy: campaign.createdBy, variant: variant ?? null }
    ),
  // Push + bandeja in-app: el módulo Notification aplica de nuevo el opt-in de PROMOTION (doble verificación)
  PUSH: async (campaign, audience) => {
    const { queued } = await notificationService.broadcast(
      audience.map((member) => member.userId),
      { type: "PROMOTION", message: { title: campaign.subject, body: htmlToText(campaign.content).slice(0, 500) }, url: campaign.url ? withUtm(campaign.url, campaign.id) : undefined, channels: ["IN_APP", "PUSH"] }
    );
    return { sent: queued, failed: 0 };
  },
  // WhatsApp: un solo webhook a n8n con la lista (n8n hace el envío con su nodo de WhatsApp Business)
  WHATSAPP: async (campaign, audience) => {
    const recipients = audience.filter((member) => member.phone).map((member) => ({ phone: member.phone, firstName: member.firstName }));
    await axios.post(`${appConfig.N8N_WEBHOOK_URL.replace(/\/$/, "")}/marketing-whatsapp`, { campaignId: campaign.id, message: htmlToText(campaign.content), url: campaign.url ? withUtm(campaign.url, campaign.id) : null, recipients }, { timeout: 15_000 });
    return { sent: recipients.length, failed: audience.length - recipients.length };
  },
};

export class MarketingService {
  constructor(private readonly repository: MarketingRepository) {}

  // createCampaign => "crear campaña con audiencia y canal" (borrador, programada o envío inmediato)
  public async createCampaign(input: CampaignInput, userId: string): Promise<CampaignDto> {
    const { sendNow, scheduledAt, abTest, ...fields } = input;
    const status: CampaignStatus = scheduledAt ? "SCHEDULED" : "DRAFT";
    const row = await this.repository.create({
      ...fields,
      templateId: fields.templateId ?? null,
      url: fields.url ?? null,
      status,
      scheduledAt: scheduledAt ?? null,
      createdBy: userId,
      abTest: abTest ? { ...abTest, contentB: abTest.contentB ?? null, decideAt: null, winner: null } : null,
    });
    if (sendNow) void this.dispatch(row.id); // 202 en el controller: el envío sigue en segundo plano
    return (await this.withMetrics([sendNow ? { ...row, status: "SENDING" } : row]))[0] as CampaignDto;
  }

  // listCampaigns => "listar campañas con métricas de rendimiento"
  public async listCampaigns(query: ListCampaignsQuery): Promise<{ items: CampaignDto[]; meta: PaginationMeta }> {
    const { page: _page, limit: _limit, ...filters } = query;
    const page = toPageParams(query);
    const { items, total } = await this.repository.findMany(filters, page);
    return { items: await this.withMetrics(items), meta: buildPaginationMeta(page, total) };
  }

  public async getCampaignById(id: string): Promise<CampaignDto> {
    return (await this.withMetrics([await this.find(id)]))[0] as CampaignDto;
  }

  // updateCampaign => "modificar segmento, canal y/o programación — PATCH parcial" (sendNow => envía ahora)
  public async updateCampaign(id: string, input: UpdateCampaignInput): Promise<CampaignDto> {
    const current = await this.find(id);
    if (!EDITABLE.includes(current.status)) throw new CampaignLockedException(current.status);
    const { sendNow, abTest, ...fields } = input;
    const changes = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as CampaignWrite;
    if (abTest !== undefined) changes.abTest = abTest ? { ...abTest, contentB: abTest.contentB ?? null, decideAt: null, winner: null } : null;
    // Programar o desprogramar cambia el estado (patrón State)
    if (input.scheduledAt !== undefined) changes.status = input.scheduledAt ? "SCHEDULED" : "DRAFT";
    if (current.status === "FAILED" && changes.status === undefined) changes.status = "DRAFT";
    const updated = await this.repository.update(id, changes, EDITABLE);
    if (!updated) throw new CampaignLockedException(current.status);
    if (sendNow) void this.dispatch(id);
    return (await this.withMetrics([sendNow ? { ...updated, status: "SENDING" } : updated]))[0] as CampaignDto;
  }

  // deleteCampaignById => "archivar campaña" (las métricas y el historial se conservan)
  public async deleteCampaignById(id: string): Promise<void> {
    const current = await this.find(id);
    if (current.status === "SENDING") throw new CampaignLockedException(current.status);
    await this.repository.update(id, { status: "ARCHIVED" }, [current.status]);
  }

  // dispatchDue => job de 1 minuto: envía las campañas programadas cuya hora llegó (consulta por índice)
  public async dispatchDue(): Promise<void> {
    for (const id of await this.repository.dueIds(new Date())) await this.dispatch(id);
    await this.decideTests(); // RF-21.4 pruebas A/B cuya espera terminó
  }

  // decideTests => compara A y B por la métrica elegida y envía la ganadora al resto de la audiencia
  private async decideTests(): Promise<void> {
    for (const campaign of await this.repository.claimTestsToDecide(new Date())) {
      try {
        const stats = await emailService.variantStats(campaign.id);
        const winner = chooseWinner(stats, campaign.abTest?.metric ?? "OPEN");
        await this.repository.setWinner(campaign.id, winner);
        const already = await emailService.sentEmails(campaign.id);
        const rest = (await crmService.audience(campaign.audience)).filter((member) => !already.has(member.email.toLowerCase()));
        const result = rest.length ? await SENDERS.EMAIL(campaign, rest, winner) : { sent: 0, failed: 0 };
        await this.repository.finish(campaign.id, { status: "SENT", targeted: campaign.metrics.targeted + rest.length, sent: campaign.metrics.sent + result.sent, failed: campaign.metrics.failed + result.failed, error: null });
      } catch (error) {
        const message = (error instanceof Error ? error.message : String(error)).slice(0, 300);
        await this.repository.finish(campaign.id, { status: "FAILED", ...campaign.metrics, error: message });
      }
    }
  }

  // dispatch => Template Method: reclamar (atómico) -> audiencia -> estrategia del canal -> cerrar con métricas
  private async dispatch(id: string): Promise<void> {
    const campaign = await this.repository.claim(id);
    if (!campaign) return; // Otra réplica o petición ya la tomó
    let audienceSize = 0;
    try {
      const audience = await crmService.audience(campaign.audience);
      audienceSize = audience.length;
      // RF-21.4 prueba A/B: muestra dividida en dos mitades; el resto espera a la variante ganadora
      if (campaign.abTest && campaign.channel === "EMAIL" && audience.length >= AB_MIN_AUDIENCE) {
        const { groupA, groupB } = splitAudience(audience, campaign.abTest.testPercent);
        const [a, b] = await Promise.all([SENDERS.EMAIL(campaign, groupA, "A"), SENDERS.EMAIL(campaign, groupB, "B")]);
        await this.repository.startTest(id, new Date(Date.now() + campaign.abTest.waitHours * 3_600_000), { targeted: groupA.length + groupB.length, sent: a.sent + b.sent, failed: a.failed + b.failed });
        return;
      }
      const { sent, failed } = audience.length > 0 ? await SENDERS[campaign.channel](campaign, audience) : { sent: 0, failed: 0 };
      await this.repository.finish(id, { status: "SENT", targeted: audience.length, sent, failed, error: null });
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 300);
      logger.warn("campaign_dispatch_failed", { campaignId: id, error: message });
      await this.repository.finish(id, { status: "FAILED", targeted: audienceSize, sent: 0, failed: audienceSize, error: message });
    }
  }

  private async find(id: string): Promise<CampaignRow> {
    const row = await this.repository.findById(id);
    if (!row) throw new CampaignNotFoundException(id);
    return row;
  }

  // withMetrics => aperturas, clics y conversiones del correo (UNA agregación) + ventas por UTM para los demás
  // canales (UNA consulta SQL) y ROI con el costo registrado (RF-21.5 / RF-24.3)
  private async withMetrics(rows: CampaignRow[]): Promise<CampaignDto[]> {
    const stats = await emailService.campaignStats(rows.filter((row) => row.channel === "EMAIL").map((row) => row.id));
    const others = rows.filter((row) => row.channel !== "EMAIL").map((row) => row.id);
    const byRef = others.length
      ? await prisma.$queryRaw<Array<{ id: string; orders: number; revenue: bigint }>>`
          SELECT c.id, COUNT(o.id)::int AS orders, COALESCE(SUM(o."totalCents"), 0)::bigint AS revenue
          FROM unnest(${others}::text[]) AS c(id) LEFT JOIN orders o ON o."channelRef" ILIKE '%' || c.id || '%' AND o.status <> 'CANCELLED'
          GROUP BY c.id`
      : [];
    const refs = new Map(byRef.map((row) => [row.id, { conversions: row.orders, revenueCents: Number(row.revenue) }]));
    return Promise.all(
      rows.map(async (row) => {
        const email = stats.get(row.id);
        const opened = email?.opened ?? 0;
        const clicked = email?.clicked ?? 0;
        const conversions = email?.converted ?? refs.get(row.id)?.conversions ?? 0;
        const revenueCents = email?.revenueCents ?? refs.get(row.id)?.revenueCents ?? 0;
        const rate = (value: number) => (row.metrics.sent > 0 ? Number((value / row.metrics.sent).toFixed(4)) : 0);
        const results = row.abTest ? await emailService.variantStats(row.id) : null;
        return {
          ...row,
          abTest: row.abTest ? { ...row.abTest, ...(results ? { results: { A: results.A, B: results.B } } : {}) } : null,
          metrics: { ...row.metrics, opened, openRate: rate(opened), clicked, clickRate: rate(clicked), conversions, revenueCents, roi: row.costCents > 0 ? Number(((revenueCents - row.costCents) / row.costCents).toFixed(4)) : null },
        };
      })
    );
  }
}

export const marketingService = new MarketingService(marketingRepository);
