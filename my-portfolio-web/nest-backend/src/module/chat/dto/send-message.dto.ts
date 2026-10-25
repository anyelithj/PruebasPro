// [DRY] Zod schema — entrada de chat: content + sessionId + provider
import { z } from 'zod';

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  sessionId: z.string().min(1).max(64),
  // "ollama" (chat directo) | "rag" (respuesta con fuentes del portafolio)
  provider: z.enum(['ollama', 'rag']).default('ollama'),
});

export type SendMessageDto = z.infer<typeof sendMessageSchema>;
