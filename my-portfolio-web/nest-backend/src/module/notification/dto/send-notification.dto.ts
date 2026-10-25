// [DRY] Zod schema — envío de notificación multicanal
import { z } from 'zod';

export const sendNotificationSchema = z.object({
  channel: z.enum(['whatsapp', 'telegram', 'email']),
  recipient: z.string().min(1).max(255),
  message: z.string().min(1).max(4000),
  eventType: z.string().max(40).optional(),
});

export type SendNotificationDto = z.infer<typeof sendNotificationSchema>;
