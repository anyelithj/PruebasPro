// [DRY] única fuente de verdad del chat IA — la usan composables, stores y BFF.
import { z } from 'zod';

// Mensaje persistido / renderizado en la conversación.
export const chatMessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

// Entrada del usuario hacia el backend (Nest | FastAPI).
export const sendMessageSchema = z.object({
  content: z.string().min(1, 'Escribe un mensaje').max(4000),
  sessionId: z.string().min(1).max(64),
  provider: z.enum(['ollama', 'rag']).default('ollama'),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// [ISP] evento de streaming SSE/WS — contrato mínimo, discriminado por `type`.
export const streamEventSchema = z.object({
  type: z.enum(['chunk', 'source', 'done', 'error']),
  content: z.string().optional(),
  source: z.string().optional(),
});
export type StreamEvent = z.infer<typeof streamEventSchema>;
