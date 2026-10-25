import { Injectable } from '@nestjs/common';
import {
  AssistantClientService,
  type Conversation,
} from '../../../ai/assistant-client.service';
// [UseCases GetGuideConversation + DeleteConversation · Sprint 7.10]: leer y borrar la conversación PROPIA con el Agente Guía | [Patrón]: Query + Command (Proxy hacia FastAPI) | [Principio]: SRP + mínimo privilegio (FastAPI comprueba que la sesión es del usuario del JWT; si no, 404) | [Paradigma]: POO + async/await

@Injectable()
export class GetGuideConversationUseCase {
  constructor(private readonly assistant: AssistantClientService) {}

  execute(sessionId: string, token: string): Promise<Conversation> {
    return this.assistant.conversation(sessionId, token);
  }
}

@Injectable()
export class DeleteConversationUseCase {
  constructor(private readonly assistant: AssistantClientService) {}

  async execute(sessionId: string, token: string): Promise<{ deleted: true }> {
    await this.assistant.deleteConversation(sessionId, token);
    return { deleted: true };
  }
}
