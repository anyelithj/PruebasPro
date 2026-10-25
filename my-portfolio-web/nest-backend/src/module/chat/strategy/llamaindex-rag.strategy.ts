// [STRATEGY][OCP] RAG sobre el portafolio — delega en FastAPI (LlamaIndex + pgvector).
// NestJS no reimplementa el índice: proxya el stream SSE del backend Python.
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatEvent, chatDone, chatError } from '../dto/chat-event.dto';
import { AiProvider, ChatHistory } from './ai-provider.interface';

@Injectable()
export class LlamaindexRagStrategy implements AiProvider {
  readonly name = 'rag';

  constructor(private readonly config: ConfigService) {}

  async *stream(
    message: string,
    _history: ChatHistory,
    _systemPrompt?: string,
  ): AsyncIterable<ChatEvent> {
    const baseUrl = this.config.get<string>('ai.fastapiBaseUrl') ?? 'http://localhost:8000';

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/v1/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message, session_id: 'nest-rag', provider: 'rag' }),
      });
    } catch (e) {
      yield chatError(`No se pudo conectar con FastAPI RAG: ${(e as Error).message}`);
      yield chatDone();
      return;
    }

    if (!response.ok || !response.body) {
      yield chatError(`FastAPI RAG respondió ${response.status}`);
      yield chatDone();
      return;
    }

    // Reenvía los eventos SSE (`data: {...}`) de FastAPI tal cual.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';
      for (const frame of frames) {
        const line = frame.replace(/^data:\s*/, '').trim();
        if (!line || line === '[DONE]') continue;
        try {
          yield JSON.parse(line) as ChatEvent;
        } catch {
          // frame parcial: se ignora
        }
      }
    }
    yield chatDone();
  }
}
