// webhook.dto.ts => contratos de salida del módulo Webhooks (CreateWebhookDto, UpdateWebhookDto, ExecutionDto).
import type { DeliveryStatus, WebhookEvent } from "../model/webhook.model";

// DeliveryMetricsDto => métricas de entrega de los últimos 30 días
export interface DeliveryMetricsDto {
  deliveries: number;
  successRate: number;
  avgDurationMs: number;
}

// WebhookDto => endpoint registrado (sin el secreto)
export interface WebhookDto {
  id: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  active: boolean;
  maxAttempts: number;
  lastDeliveryAt: Date | null;
  metrics: DeliveryMetricsDto;
  createdAt: Date;
  updatedAt: Date;
}

// WebhookWithSecretDto => respuesta de crear/rotar: el secreto se muestra UNA vez (luego solo se usa para firmar)
export interface WebhookWithSecretDto extends WebhookDto {
  secret: string;
}

// ExecutionDto => una entrega (log de webhook)
export interface ExecutionDto {
  id: string;
  webhookId: string;
  event: string;
  status: DeliveryStatus;
  attempts: number;
  httpStatus: number | null;
  durationMs: number;
  error: string | null;
  createdAt: Date;
  deliveredAt: Date | null;
}
