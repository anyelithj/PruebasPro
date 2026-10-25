// webhook.handler.ts => DESPACHADOR de eventos de dominio hacia los endpoints externos suscritos (sprint 7.2).
// Patrones: Observer (escucha el bus de comercio e inventario), Command con reintentos (cada entrega se reintenta con
// backoff exponencial según la retry policy del endpoint) y Adapter (Axios traduce la entrega a HTTP).
// Seguridad: cada entrega va firmada con HMAC-SHA256 (estilo Stripe): "X-Webhook-Signature: t=<unix>,v1=<hex>",
// firma de "<t>.<cuerpo>" => el receptor verifica autenticidad e integridad y rechaza reenvíos viejos por el timestamp.
import crypto from "node:crypto"; // Módulo nativo de Node: HMAC (sin dependencias extra)
import axios, { AxiosError } from "axios";
import { webhookRepository, type WebhookRepository, type WebhookTarget } from "../repository/webhook.repository";
import type { WebhookEvent } from "../model/webhook.model";
import type { ExecutionDto } from "../dto/webhook.dto";
import { COMMERCE_AUTOMATION_EVENTS } from "../../automation/model/automation.model";
import { commerceEvents } from "../../order/event/order.event";
import { inventoryEvents } from "../../inventory/event/inventory.event";
import { logger } from "../../../shared/middleware/logger.middleware";

const TIMEOUT_MS = 10_000;
const BASE_BACKOFF_MS = 1_000; // 1 s, 2 s, 4 s, 8 s... (tope 60 s)
const MAX_BACKOFF_MS = 60_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// signPayload => firma HMAC-SHA256 en hexadecimal de "<timestamp>.<cuerpo>" (función pura, verificable en tests)
export function signPayload(secret: string, timestamp: number, body: string): string {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

// retryable => 5xx, 429 o error de red se reintentan; un 4xx es un error del receptor (reintentar no sirve)
function retryable(error: unknown): boolean {
  if (!(error instanceof AxiosError) || !error.response) return true;
  return error.response.status >= 500 || error.response.status === 429;
}

export class WebhookDispatcher {
  constructor(private readonly repository: WebhookRepository = webhookRepository) {}

  // dispatch => busca los endpoints suscritos y entrega en segundo plano (el publicador del evento no espera)
  public async dispatch(event: WebhookEvent, data: unknown): Promise<void> {
    const targets = await this.repository.findTargets(event);
    for (const target of targets) void this.deliver(target, event, data);
  }

  // deliver => crea la bitácora y ejecuta el Command con reintentos; siempre cierra el registro (éxito o fallo)
  public async deliver(target: WebhookTarget, event: WebhookEvent, data: unknown, maxAttempts = target.maxAttempts): Promise<ExecutionDto> {
    const delivery = await this.repository.createDelivery(target.id, event);
    // El ID de la entrega viaja en el cuerpo y en un header: el receptor lo usa para idempotencia
    const body = JSON.stringify({ id: delivery.id, event, occurredAt: new Date().toISOString(), data });
    const startedAt = Date.now();
    let attempts = 0;
    let httpStatus: number | null = null;
    let lastError: unknown = null;
    while (attempts < maxAttempts) {
      attempts += 1;
      const timestamp = Math.floor(Date.now() / 1000);
      try {
        const response = await axios.post(target.url, body, {
          timeout: TIMEOUT_MS,
          maxRedirects: 0, // Sin redirecciones: un 3xx no puede desviar la entrega a otro host (anti-SSRF)
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "ecommerce-web3-webhooks/1.0",
            "X-Webhook-Event": event,
            "X-Webhook-Id": delivery.id,
            "X-Webhook-Signature": `t=${timestamp},v1=${signPayload(target.secret, timestamp, body)}`,
          },
        });
        httpStatus = response.status;
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        httpStatus = error instanceof AxiosError ? (error.response?.status ?? null) : null;
        if (!retryable(error) || attempts >= maxAttempts) break;
        await sleep(Math.min(BASE_BACKOFF_MS * 2 ** (attempts - 1), MAX_BACKOFF_MS));
      }
    }
    const error = lastError ? (lastError instanceof Error ? lastError.message : String(lastError)).slice(0, 300) : null;
    if (error) logger.warn("webhook_delivery_failed", { webhookId: target.id, event, attempts, httpStatus });
    return this.repository.finishDelivery(delivery, { status: error ? "FAILED" : "SUCCESS", attempts, httpStatus, durationMs: Date.now() - startedAt, error });
  }

  // registerSubscribers => Observer: eventos de comercio + stock bajo -> endpoints suscritos (bootstrap, una vez)
  public registerSubscribers(): void {
    for (const event of COMMERCE_AUTOMATION_EVENTS) commerceEvents.on(event, (data) => this.dispatch(event, data));
    inventoryEvents.on("inventory.low", (level) => this.dispatch("inventory.low", level));
  }
}

export const webhookDispatcher = new WebhookDispatcher();
