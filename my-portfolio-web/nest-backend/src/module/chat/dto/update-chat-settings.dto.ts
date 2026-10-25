// [DRY] Zod schema — actualización del system prompt del chat (admin).
import { z } from 'zod';

export const updateChatSettingsSchema = z.object({
  systemPrompt: z.string().min(1).max(6000),
});

export type UpdateChatSettingsDto = z.infer<typeof updateChatSettingsSchema>;
