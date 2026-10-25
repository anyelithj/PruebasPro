// [FACADE][SRP] orquesta IA + historial — no toca HTTP directamente.
import { Injectable, Logger } from '@nestjs/common';
import { ChatEvent, chatError } from '../dto/chat-event.dto';
import { SendMessageDto } from '../dto/send-message.dto';
import { MessageModel } from '../model/message.model';
import { ChatRepository } from '../repository/chat.repository';
import { DEFAULT_SYSTEM_PROMPT } from '../strategy/ollama-langchain.strategy';
import { AiProviderService } from './ai-provider.service';

// Clave del ajuste editable desde el panel admin.
const SYSTEM_PROMPT_KEY = 'chat_system_prompt';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly repository: ChatRepository,
    private readonly providers: AiProviderService,
  ) {}

  history(sessionId: string): Promise<MessageModel[]> {
    return this.repository.history(sessionId);
  }

  // [ADMIN] gestión del chat: system prompt editable + sesiones.
  async getSystemPrompt(): Promise<string> {
    return (await this.repository.getSetting(SYSTEM_PROMPT_KEY)) ?? DEFAULT_SYSTEM_PROMPT;
  }

  async setSystemPrompt(value: string): Promise<void> {
    await this.repository.setSetting(SYSTEM_PROMPT_KEY, value);
  }

  listSessions(): Promise<
    Array<{ sessionId: string; messageCount: number; lastMessageAt: Date }>
  > {
    return this.repository.listSessions();
  }

  deleteSession(sessionId: string): Promise<number> {
    return this.repository.deleteSession(sessionId);
  }

  // Streamea la respuesta del provider y persiste user + assistant.
  async *stream(dto: SendMessageDto, userId?: string): AsyncIterable<ChatEvent> {
    await this.repository.create({
      sessionId: dto.sessionId,
      role: 'user',
      content: dto.content,
      userId: userId ?? null,
    });

    const history = (await this.repository.history(dto.sessionId)).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const provider = this.providers.get(dto.provider);
    const systemPrompt = await this.getSystemPrompt();
    const buffer: string[] = [];

    try {
      for await (const event of provider.stream(dto.content, history, systemPrompt)) {
        if (event.type === 'chunk' && event.content) buffer.push(event.content);
        yield event;
      }
    } catch (e) {
      this.logger.error(`Chat stream failed: ${(e as Error).message}`);
      yield chatError('La generación falló, intenta de nuevo');
    }

    const answer = buffer.join('').trim();
    if (answer) {
      await this.repository.create({
        sessionId: dto.sessionId,
        role: 'assistant',
        content: answer,
        userId: userId ?? null,
      });
    }
  }
}
