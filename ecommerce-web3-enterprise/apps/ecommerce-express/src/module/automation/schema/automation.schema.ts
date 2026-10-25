// automation.schema.ts => validación Zod del módulo Automation (WorkflowSchema, RunSchema).
import { z } from "zod";
import { PaginationQuerySchema } from "../../../shared/util/pagination.util";
import { AUTOMATION_EVENTS, TriggerTypes } from "../model/automation.model";

// webhookPath => solo letras, números, "-", "_" y "/" (sin "..", sin esquema ni host): se concatena a N8N_WEBHOOK_URL
const WebhookPath = z.string().trim().regex(/^[\w-]+(\/[\w-]+)*$/, { message: "webhookPath inválido (ej. pedidos/nuevo)" }).max(120);

// WorkflowSchema => POST /api/v1/automation. "definition" (opcional) = JSON del flujo de n8n (nodes + connections):
// si llega, el flujo se crea también en n8n mediante su API pública
export const WorkflowSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    description: z.string().trim().max(500).optional(),
    triggerType: z.enum(TriggerTypes),
    event: z.enum(AUTOMATION_EVENTS).optional(),
    webhookPath: WebhookPath,
    active: z.boolean().default(true),
    definition: z
      .object({
        nodes: z.array(z.record(z.unknown())).min(1).max(100),
        connections: z.record(z.unknown()),
        settings: z.record(z.unknown()).default({}),
      })
      .optional(),
  })
  // Regla cruzada: un disparador EVENT necesita el nombre del evento
  .refine((value) => value.triggerType !== "EVENT" || value.event !== undefined, { message: "event es obligatorio con triggerType EVENT", path: ["event"] });

// UpdateWorkflowSchema => PATCH parcial (la definición en n8n se edita en el editor visual de n8n)
export const UpdateWorkflowSchema = z.object({
  name: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  triggerType: z.enum(TriggerTypes).optional(),
  event: z.enum(AUTOMATION_EVENTS).optional(),
  webhookPath: WebhookPath.optional(),
  active: z.boolean().optional(),
});

// RunSchema => POST /api/v1/automation/:id/run — datos de entrada para el flujo (acotados)
export const RunSchema = z.object({ payload: z.record(z.unknown()).default({}) }).refine((value) => JSON.stringify(value.payload).length <= 10_000, {
  message: "payload máximo 10 KB",
});

export const ListWorkflowsQuerySchema = PaginationQuerySchema;

export type WorkflowInput = z.infer<typeof WorkflowSchema>;
export type UpdateWorkflowInput = z.infer<typeof UpdateWorkflowSchema>;

// ---------- RF-20.2 / 20.6 / 20.7 ----------
export const HealthQuerySchema = z.object({ days: z.coerce.number().int().min(1).max(90).default(7) });
export const RollbackSchema = z.object({ version: z.coerce.number().int().min(1) });
export const WhatsAppActionSchema = z.object({ userId: z.string().uuid(), text: z.string().trim().min(1).max(1000) });
export const NotifyStaffSchema = z.object({ title: z.string().trim().min(3).max(140), body: z.string().trim().min(1).max(1000) });
