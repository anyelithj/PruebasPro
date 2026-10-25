// email.service.ts => correo de la tienda. Dos responsabilidades cohesionadas (Facade del módulo):
//   1) Transporte: "send(to, content)" sin conocer el proveedor (DIP). Cadena armada según la configuración (Factory):
//        por defecto:              SMTP (Nodemailer, gratuito)
//        con AZURE_ENABLED=true:   Azure Communication Services -> si falla, SMTP (failover automático)
//   2) API admin (Fase 7): plantillas con variables "{{ x }}", envío individual/masivo con historial y tracking de
//      apertura (píxel 1x1), métricas por campaña para Marketing.
// Ahorro: los envíos masivos van en SERIE (una conexión SMTP a la vez, sin picos de CPU/red) y en segundo plano.
import { appConfig } from "../../../config/app.config";
import { escapeHtml, extractVariables, htmlToText, renderTemplate, type EmailContent, type TemplateVariables } from "../util/template.util";
import { renderBlocks, trackLinks, verifyLink, type EmailBlock } from "../util/blocks.util"; // RF-21.5 / RF-21.6
import { commerceEvents } from "../../order/event/order.event";
import { prisma } from "../../../config/database.config";
import { logger } from "../../../shared/middleware/logger.middleware";
import { FailoverEmailProvider, type EmailProvider } from "../provider/email.provider";
import { SmtpEmailProvider } from "../provider/smtp.provider";
import { AzureEmailProvider } from "../provider/azure.provider";
import { emailRepository, type EmailRepository, type TemplateWrite } from "../repository/email.repository";
import { EmailNotFoundException, EmailTemplateNameTakenException, EmailTemplateNotFoundException } from "../exception/email.exception";
import type { BulkResultDto, EmailLogDto, EmailTemplateDto, Recipient, SendEmailDto } from "../dto/email.dto";
import type { ListEmailsQuery, SendEmailInput, TemplateInput, UpdateTemplateInput } from "../schema/email.schema";
import { buildPaginationMeta, toPageParams } from "../../../shared/util/pagination.util";
import type { PaginationMeta } from "../../../shared/types/pagination.types";

// buildProviders => función pura de configuración: Azure solo entra si está habilitado Y con credenciales
export function buildProviders(config: Pick<typeof appConfig, "AZURE_ENABLED" | "AZURE_COMMUNICATION_CONNECTION_STRING" | "AZURE_EMAIL_SENDER">): EmailProvider[] {
  const providers: EmailProvider[] = [];
  if (config.AZURE_ENABLED && config.AZURE_COMMUNICATION_CONNECTION_STRING && config.AZURE_EMAIL_SENDER) {
    providers.push(new AzureEmailProvider(config.AZURE_COMMUNICATION_CONNECTION_STRING, config.AZURE_EMAIL_SENDER));
  }
  providers.push(new SmtpEmailProvider()); // Siempre al final: alternativa gratuita
  return providers;
}

// trackingPixel => <img> 1x1 que avisa la apertura (alt vacío: decorativa para lectores de pantalla)
const trackingPixel = (logId: string) =>
  `<img src="${appConfig.API_BASE_URL}/api/v1/email/${logId}/open" width="1" height="1" alt="" style="display:block;border:0" />`;

// withPixel => inserta el píxel antes de </body> (o al final si la plantilla no trae <body>)
function withPixel(html: string, logId: string): string {
  return html.includes("</body>") ? html.replace("</body>", `${trackingPixel(logId)}</body>`) : `${html}${trackingPixel(logId)}`;
}

// Contenido a enviar antes de personalizar (subject/html/text con marcadores "{{ x }}")
export interface DraftContent {
  subject: string;
  html: string;
  text?: string | null | undefined;
}

const CONVERSION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // RF-21.5 compra hasta 7 días después del clic

export class EmailService {
  constructor(
    private readonly provider: EmailProvider = new FailoverEmailProvider(buildProviders(appConfig), (name, error) =>
      logger.warn("email_provider_failed_using_fallback", { provider: name, error })
    ),
    private readonly repository: EmailRepository = emailRepository
  ) {}

  // send => envía un correo ya renderizado (transaccional: verificación, 2FA, notificaciones)
  public async send(to: string, content: EmailContent): Promise<void> {
    await this.provider.send(to, content);
    logger.debug("email_sent", { to, subject: content.subject });
  }

  // createEmail => POST /email/send: 1 destinatario se envía en la petición; varios quedan en cola (202)
  public async createEmail(input: SendEmailInput, sentBy: string): Promise<SendEmailDto> {
    const template = input.templateId ? await this.findTemplate(input.templateId) : null;
    const draft: DraftContent = template ?? { subject: input.subject ?? "", html: input.html ?? "", text: input.text };
    const recipients = input.to.map((to) => ({ to, variables: input.variables }));
    const logs = await this.queue(recipients, draft, { templateId: template?.id ?? null, campaignId: null, sentBy });
    const run = this.deliver(logs, recipients, draft);
    if (recipients.length === 1) await run; // Individual: el admin ve el resultado al instante
    else void run; // Masivo: en segundo plano ("void" => promesa atendida a propósito)
    return { queued: logs.length, ids: logs.map((log) => log.id) };
  }

  // sendBulk => usado por Marketing: registra y envía en serie; devuelve el conteo final para las métricas
  public async sendBulk(recipients: Recipient[], draft: DraftContent, meta: { campaignId: string; sentBy: string | null; variant?: "A" | "B" | null }): Promise<BulkResultDto> {
    const logs = await this.queue(recipients, draft, { templateId: null, ...meta });
    return this.deliver(logs, recipients, draft);
  }

  // listEmails => "historial de emails enviados"
  public async listEmails(query: ListEmailsQuery): Promise<{ items: EmailLogDto[]; meta: PaginationMeta }> {
    const { page: _page, limit: _limit, ...filters } = query;
    const page = toPageParams(query);
    const { items, total } = await this.repository.findMany(filters, page);
    return { items, meta: buildPaginationMeta(page, total) };
  }

  // getEmailById => "detalle con tracking de apertura por ID"
  public async getEmailById(id: string): Promise<EmailLogDto> {
    const log = await this.repository.findById(id);
    if (!log) throw new EmailNotFoundException(id);
    return log;
  }

  // registerOpen => píxel de tracking (público): nunca falla hacia el cliente de correo
  public async registerOpen(id: string): Promise<void> {
    await this.repository.registerOpen(id).catch(() => undefined);
  }

  public campaignStats(campaignIds: string[]) {
    return this.repository.campaignStats(campaignIds);
  }

  public variantStats(campaignId: string) {
    return this.repository.variantStats(campaignId);
  }

  public sentEmails(campaignId: string) {
    return this.repository.sentEmails(campaignId);
  }

  // registerClick => RF-21.5 enlace firmado: cuenta el clic y devuelve el destino (null si la firma no cuadra)
  public async registerClick(id: string, url: string, signature: string): Promise<string | null> {
    if (!verifyLink(appConfig.JWT_ACCESS_SECRET, id, url, signature)) return null;
    await this.repository.registerClick(id).catch(() => undefined);
    return url;
  }

  // registerSubscribers => RF-21.5 conversión: cada pedido se atribuye al último clic de campaña del cliente (7 días)
  public registerSubscribers(): void {
    commerceEvents.on("order.placed", async (event) => {
      const user = await prisma.user.findUnique({ where: { id: event.userId }, select: { email: true } });
      if (user) await this.repository.attributeConversion(user.email, event.totalCents, new Date(Date.now() - CONVERSION_WINDOW_MS));
    });
  }

  // --- Plantillas ---

  public listEmailTemplates(): Promise<EmailTemplateDto[]> {
    return this.repository.findTemplates();
  }

  // createEmailTemplate => "crear plantilla con variables dinámicas" (las variables se detectan del contenido)
  public async createEmailTemplate(input: TemplateInput, createdBy: string): Promise<EmailTemplateDto> {
    if (await this.repository.findTemplateByName(input.name)) throw new EmailTemplateNameTakenException();
    const html = input.blocks ? renderBlocks(input.blocks, input.locale) : (input.html ?? ""); // RF-21.6 HTML desde bloques
    const variables = extractVariables(input.subject, html, input.text ?? "");
    return this.repository.createTemplate({ ...input, html, blocks: input.blocks ?? null, text: input.text ?? null, variables, createdBy });
  }

  // updateEmailTemplate => "actualizar plantilla existente — PATCH parcial" (recalcula las variables)
  public async updateEmailTemplate(id: string, input: UpdateTemplateInput): Promise<EmailTemplateDto> {
    const current = await this.findTemplate(id);
    if (input.name && input.name !== current.name && (await this.repository.findTemplateByName(input.name))) throw new EmailTemplateNameTakenException();
    const changes = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as TemplateWrite;
    if (input.blocks) changes.html = renderBlocks(input.blocks as EmailBlock[], input.locale ?? current.locale); // RF-21.6
    const merged = { ...current, ...changes };
    const variables = extractVariables(merged.subject, merged.html, merged.text ?? "");
    const updated = await this.repository.updateTemplate(id, { ...changes, variables });
    if (!updated) throw new EmailTemplateNotFoundException(id);
    return updated;
  }

  // deleteEmailTemplateById => "eliminar plantilla de email" (el historial conserva su templateId como referencia)
  public async deleteEmailTemplateById(id: string): Promise<void> {
    if (!(await this.repository.deleteTemplate(id))) throw new EmailTemplateNotFoundException(id);
  }

  public async findTemplate(id: string): Promise<EmailTemplateDto> {
    const template = await this.repository.findTemplate(id);
    if (!template) throw new EmailTemplateNotFoundException(id);
    return template;
  }

  // queue => una fila QUEUED por destinatario (el asunto ya personalizado queda en el historial)
  private queue(recipients: Recipient[], draft: DraftContent, meta: { templateId: string | null; campaignId: string | null; sentBy: string | null; variant?: "A" | "B" | null }): Promise<EmailLogDto[]> {
    return this.repository.queueMany(recipients.map((recipient) => ({ to: recipient.to, subject: renderTemplate(draft.subject, recipient.variables ?? {}, false), ...meta })));
  }

  // deliver => envío en SERIE (ahorro de recursos, sin saturar SMTP); cada resultado actualiza su log
  private async deliver(logs: EmailLogDto[], recipients: Recipient[], draft: DraftContent): Promise<BulkResultDto> {
    let sent = 0;
    for (const [index, log] of logs.entries()) {
      const variables: TemplateVariables = recipients[index]?.variables ?? {};
      // RF-21.5 enlaces con seguimiento de clics + UTM de la campaña (solo en correos registrados con campaña o plantilla)
      const rendered = renderTemplate(draft.html, variables, true);
      const html = log.campaignId ? trackLinks(rendered, log.id, log.campaignId, appConfig.API_BASE_URL, appConfig.JWT_ACCESS_SECRET) : rendered;
      const content: EmailContent = {
        subject: log.subject,
        html: withPixel(html, log.id),
        text: draft.text ? renderTemplate(draft.text, variables, false) : htmlToText(html),
      };
      try {
        await this.send(log.to, content);
        await this.repository.markSent(log.id);
        sent += 1;
      } catch (error) {
        await this.repository.markFailed(log.id, escapeHtml(error instanceof Error ? error.message : String(error)).slice(0, 300));
      }
    }
    return { sent, failed: logs.length - sent };
  }
}

export const emailService = new EmailService();
