import { Injectable } from '@nestjs/common';
import { AssistantClientService } from '../../../ai/assistant-client.service';
import type {
  AgentTurn,
  GameAgentPort,
  GameContextDto,
} from '../../domain/interfaces/game-agent.interface';
// [Adapter GameAgentClient · Sprints 8.5/8.7]: implementa GameAgentPort con el cliente ÚNICO del Assistant de FastAPI (persona «game») | [Patrón]: Adapter | [Principio]: DIP + DRY (no crea otro cliente HTTP) | [Paradigma]: POO

@Injectable()
export class GameAgentClient implements GameAgentPort {
  constructor(private readonly assistant: AssistantClientService) {}

  async turn(
    input: {
      message: string;
      conversationId?: string | null;
      language: string;
      level?: string | null;
      game: GameContextDto;
    },
    token: string,
  ): Promise<AgentTurn> {
    const res = await this.assistant.gameTurn(
      { ...input, sessionId: input.conversationId },
      token,
    );
    return {
      sessionId: res.session_id,
      reply: res.reply,
      answeredBy: res.answered_by ?? 'llm',
      state: res.game ?? {},
    };
  }
}
