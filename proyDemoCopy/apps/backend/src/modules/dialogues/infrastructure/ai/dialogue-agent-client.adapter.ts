import { Injectable } from '@nestjs/common';
import { AssistantClientService } from '../../../ai/assistant-client.service';
import type {
  AvatarTurn,
  DialogueAgentPort,
  DialogueContextDto,
} from '../../domain/interfaces/dialogue-agent.interface';
// [Adapter DialogueAgentClient · Sprints 9.3/9.6]: implementa DialogueAgentPort con el cliente ÚNICO del Assistant de FastAPI (persona «dialogue») | [Patrón]: Adapter | [Principio]: DIP + DRY (no crea otro cliente HTTP) | [Paradigma]: POO

@Injectable()
export class DialogueAgentClient implements DialogueAgentPort {
  constructor(private readonly assistant: AssistantClientService) {}

  async turn(
    input: {
      message: string;
      conversationId?: string | null;
      language: string;
      level: string;
      dialogue: DialogueContextDto;
    },
    token: string,
  ): Promise<AvatarTurn> {
    const res = await this.assistant.dialogueTurn(
      { ...input, sessionId: input.conversationId },
      token,
    );
    const state = res.dialogue ?? {};
    return {
      sessionId: res.session_id,
      reply: res.reply,
      answeredBy: res.answered_by ?? 'llm',
      correction:
        typeof state.correction === 'string' ? state.correction : null,
      translation:
        typeof state.translation === 'string' ? state.translation : null,
      learnerTranslation:
        typeof state.learner_translation === 'string' ? state.learner_translation : null,
      vocabularyUsed: Array.isArray(state.vocabulary_used)
        ? (state.vocabulary_used as string[])
        : [],
      finished: state.finished === true, // [2026-10-23]: despedida detectada en FastAPI
    };
  }
}
