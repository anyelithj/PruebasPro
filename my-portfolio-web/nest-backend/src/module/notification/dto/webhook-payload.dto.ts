// [DRY][ISP] payload genérico de webhook validado — n8n / WhatsApp / Telegram
import { z } from 'zod';

export const webhookPayloadSchema = z.object({
  provider: z.string().min(1).max(40),
  event: z.string().max(80).optional(),
  data: z.record(z.unknown()).default({}),
});

export type WebhookPayloadDto = z.infer<typeof webhookPayloadSchema>;
