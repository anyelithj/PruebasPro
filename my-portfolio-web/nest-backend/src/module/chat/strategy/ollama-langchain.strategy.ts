// [STRATEGY][OCP] chat directo contra Ollama (Qwen2.5) — sin API keys de terceros.
// Habla la API HTTP de Ollama (/api/chat, stream NDJSON) con fetch nativo (Node 18+).
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatEvent, chatChunk, chatDone, chatError } from '../dto/chat-event.dto';
import { AiProvider, ChatHistory } from './ai-provider.interface';

export const DEFAULT_SYSTEM_PROMPT =
  'Eres el asistente del portafolio de Anghelo. Responde claro, conciso y amable ' +
  'en el idioma del usuario. No inventes datos.';

@Injectable()
export class OllamaLangchainStrategy implements AiProvider {
  readonly name = 'ollama';

  constructor(private readonly config: ConfigService) {}

  async *stream(
    message: string,
    history: ChatHistory,
    systemPrompt?: string,
  ): AsyncIterable<ChatEvent> {
    const baseUrl = this.config.get<string>('ai.ollamaBaseUrl') ?? 'http://localhost:11434';
    const model = this.config.get<string>('ai.chatModel') ?? 'qwen2.5:7b';
    const temperature = this.config.get<number>('ai.temperature') ?? 0.7;

    const messages = [
      { role: 'system', content: systemPrompt || DEFAULT_SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, stream: true, options: { temperature } }),
      });
    } catch (e) {
      yield chatError(`No se pudo conectar con Ollama: ${(e as Error).message}`);
      yield chatDone();
      return;
    }

    if (!response.ok || !response.body) {
      yield chatError(`Ollama respondió ${response.status}`);
      yield chatDone();
      return;
    }

    // El stream de Ollama es NDJSON: una línea JSON por token.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
          const content = json.message?.content;
          if (content) yield chatChunk(content);
        } catch {
          // línea parcial: se ignora, se completa en la siguiente iteración
        }
      }
    }
    yield chatDone();
  }
}
