// webhook.service.ts => registro de endpoints, retry policy, rotación de secreto y entregas de prueba (sprint 7.2).
// La entrega real la hace webhook.handler.ts (SRP: este servicio administra; el handler despacha).
import crypto from "node:crypto";
import { webhookRepository, EMPTY_METRICS, type WebhookRepository, type WebhookWrite } from "../repository/webhook.repository";
import { webhookDispatcher, type WebhookDispatcher } from "../handler/webhook.handler";
import { WebhookInactiveException, WebhookNotFoundException, WebhookUrlNotAllowedException } from "../exception/webhook.exception";
import type { ExecutionDto, WebhookDto, WebhookWithSecretDto } from "../dto/webhook.dto";
import type { ExecutionInput, UpdateWebhookInput, WebhookInput } from "../schema/webhook.schema";
import { isProduction } from "../../../config/app.config";
import { buildPaginationMeta, toPageParams, type PaginationQuery } from "../../../shared/util/pagination.util";
import type { PaginationMeta } from "../../../shared/types/pagination.types";

// Hosts internos que nunca reciben webhooks en producción (anti-SSRF: la API no debe sondear la red privada)
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.0|\[?::1\]?|.*\.(internal|local)$)/i;

// isAllowedUrl => función pura: en producción exige https y host público; en desarrollo permite localhost
export function isAllowedUrl(url: string, production = isProduction): boolean {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) return false;
  if (!production) return true;
  return parsed.protocol === "https:" && !PRIVATE_HOST.test(parsed.hostname);
}

const newSecret = () => crypto.randomBytes(32).toString("hex"); // 256 bits aleatorios

export class WebhookService {
  constructor(
    private readonly repository: WebhookRepository,
    private readonly dispatcher: WebhookDispatcher
  ) {}

  // createWebhook => "registrar endpoint con eventos suscritos"; el secreto se devuelve SOLO aquí
  public async createWebhook(input: WebhookInput, userId: string): Promise<WebhookWithSecretDto> {
    if (!isAllowedUrl(input.url)) throw new WebhookUrlNotAllowedException();
    const secret = input.secret ?? newSecret();
    const row = await this.repository.create({ name: input.name, url: input.url, events: input.events, active: input.active, maxAttempts: input.maxAttempts, secret, createdBy: userId });
    return { ...row, metrics: EMPTY_METRICS, secret };
  }

  // listWebhooks => "webhooks con métricas de entrega"
  public async listWebhooks(query: PaginationQuery): Promise<{ items: WebhookDto[]; meta: PaginationMeta }> {
    const page = toPageParams(query);
    const { items, total } = await this.repository.findMany(page);
    const metrics = await this.repository.metrics(items.map((item) => item.id));
    return { items: items.map((item) => ({ ...item, metrics: metrics.get(item.id) ?? EMPTY_METRICS })), meta: buildPaginationMeta(page, total) };
  }

  // updateWebhook => "actualizar URL, secreto y retry policy — PATCH parcial" (rotateSecret => secreto nuevo)
  public async updateWebhook(id: string, input: UpdateWebhookInput): Promise<WebhookDto | WebhookWithSecretDto> {
    if (input.url && !isAllowedUrl(input.url)) throw new WebhookUrlNotAllowedException();
    const { rotateSecret, ...fields } = input;
    const secret = rotateSecret ? newSecret() : fields.secret;
    const changes = Object.fromEntries(Object.entries({ ...fields, secret }).filter(([, value]) => value !== undefined)) as WebhookWrite;
    const updated = await this.repository.update(id, changes);
    if (!updated) throw new WebhookNotFoundException(id);
    const metrics = (await this.repository.metrics([id])).get(id) ?? EMPTY_METRICS;
    return rotateSecret && secret ? { ...updated, metrics, secret } : { ...updated, metrics };
  }

  // deleteWebhookById => "eliminar webhook" (y su bitácora)
  public async deleteWebhookById(id: string): Promise<void> {
    if (!(await this.repository.delete(id))) throw new WebhookNotFoundException(id);
  }

  // createWebhookExecution => "crear instancia de prueba": UN intento síncrono para ver el resultado al instante
  public async createWebhookExecution(input: ExecutionInput): Promise<ExecutionDto> {
    const webhook = await this.repository.findById(input.webhookId);
    if (!webhook) throw new WebhookNotFoundException(input.webhookId);
    if (!webhook.active) throw new WebhookInactiveException();
    const [target] = await this.repository.findTargets("webhook.test", webhook.id);
    if (!target) throw new WebhookNotFoundException(input.webhookId);
    return this.dispatcher.deliver(target, "webhook.test", input.payload, 1);
  }
}

export const webhookService = new WebhookService(webhookRepository, webhookDispatcher);
