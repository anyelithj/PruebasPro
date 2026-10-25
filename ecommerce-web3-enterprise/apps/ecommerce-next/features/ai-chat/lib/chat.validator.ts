// chat.validator.ts (Zod) => reglas del chat con el asistente (espejo de llm_schema.py de FastAPI: feedback inmediato
// sin viaje al servidor). Mensajes = claves de traducción (messages/*.json -> "validation").
import { z } from "zod";

export const MAX_MESSAGE_LENGTH = 2000; // Mismo tope que FastAPI: prompts cortos = menos cómputo por respuesta

// MessageSchema => cuerpo de POST /llm/conversations/:id/messages
export const messageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "validation.required")
    .max(MAX_MESSAGE_LENGTH, "validation.messageMax"),
});

// FeedbackSchema => 👍 = "up", 👎 = "down" (PATCH /llm/conversations/:id/messages/:id)
export const feedbackSchema = z.enum(["up", "down"]);

// "z.infer" => el tipo TypeScript sale del schema (una sola fuente de verdad)
export type MessageFormValues = z.infer<typeof messageSchema>;
export type Feedback = z.infer<typeof feedbackSchema>;
