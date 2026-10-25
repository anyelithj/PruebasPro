// [DIP][ISP] contrato de proveedor IA — stream(prompt, history): AsyncIterable<ChatEvent>
import { ChatEvent } from '../dto/chat-event.dto';

// Historial como pares role/content — role ∈ {"user", "assistant"}.
export type ChatHistory = Array<{ role: string; content: string }>;

export interface AiProvider {
  readonly name: string;
  // systemPrompt opcional: si se omite, el provider usa su prompt por defecto (LSP).
  stream(
    message: string,
    history: ChatHistory,
    systemPrompt?: string,
  ): AsyncIterable<ChatEvent>;
}
