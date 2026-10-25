// webhook.schema.ts => validación Zod del módulo Webhooks (WebhookSchema, ExecutionSchema).
import { z } from "zod";
import { PaginationQuerySchema } from "../../../shared/util/pagination.util";
import { WEBHOOK_EVENTS } from "../model/webhook.model";

// WebhookSchema => POST /api/v1/webhook. Sin "secret" se genera uno aleatorio de 32 bytes.
export const WebhookSchema = z.object({
  name: z.string().trim().min(3).max(120),
  url: z.string().trim().url().max(500),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).max(WEBHOOK_EVENTS.length),
  secret: z.string().min(16).max(200).optional(),
  maxAttempts: z.number().int().min(1).max(10).default(5),
  active: z.boolean().default(true),
});

// UpdateWebhookSchema => PATCH parcial: URL, secreto (o rotación automática) y retry policy
export const UpdateWebhookSchema = WebhookSchema.omit({ secret: true })
  .partial()
  .extend({ secret: z.string().min(16).max(200).optional(), rotateSecret: z.boolean().optional() });

// ExecutionSchema => POST /api/v1/webhook/execution: entrega de prueba (webhook id en el body)
export const ExecutionSchema = z.object({
  webhookId: z.string().regex(/^[a-f0-9]{24}$/i, { message: "webhookId inválido" }),
  payload: z.record(z.unknown()).default({}).refine((value) => JSON.stringify(value).length <= 10_000, { message: "payload máximo 10 KB" }),
});

export const ListWebhooksQuerySchema = PaginationQuerySchema;

export type WebhookInput = z.infer<typeof WebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof UpdateWebhookSchema>;
export type ExecutionInput = z.infer<typeof ExecutionSchema>;
