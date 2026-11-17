import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AIClientService } from './ai-client.service';
import { AIController } from './ai.controller';
import { AssistantClientService } from './assistant-client.service';
import { AssistantController } from './assistant.controller';
import { OllamaClient } from './ollama.client';
import { OwnLlmClientService } from './own-llm-client.service';
import { OwnLlmController } from './own-llm.controller';
import { TutorConversation } from './tutor/tutor-conversation.entity';
import { TutorConversationService } from './tutor/tutor-conversation.service';
import { TutorConversationsController } from './tutor/tutor-conversations.controller';
import { TutorMessage } from './tutor/tutor-message.entity';
// [AIModule]: puerta de IA del backend → AIClientService (hacia FastAPI) + OllamaClient (único cliente de Ollama) + controller proxy /ai/feedback/* | [Patron]: Module + DI | [Principio]: ISP + DRY

// `@Global()` (NestJS): los proveedores exportados se inyectan en cualquier módulo sin volver a importarlo
@Global()
@Module({
  imports: [
    HttpModule.register({ timeout: 30_000, maxRedirects: 2 }),
    TypeOrmModule.forFeature([TutorConversation, TutorMessage]), // [2026-10-28]: conversaciones del Tutor IA (CRUD)
  ],
  controllers: [
    AIController,
    AssistantController,
    OwnLlmController,
    TutorConversationsController,
  ], // [Sprint 5.6]: /ai/own-llm/* (LLM propio) · [2026-10-28]: /ai/assistant/conversations
  providers: [
    AIClientService,
    OllamaClient,
    AssistantClientService,
    OwnLlmClientService,
    TutorConversationService,
  ],
  exports: [
    AIClientService,
    OllamaClient,
    AssistantClientService,
    OwnLlmClientService,
  ], // [2026-11-13]: + corrector único (Diálogos) // [Export]: Quiz, Curriculum y Help (Sprint 7.10) reutilizan los mismos clientes (sin clientes HTTP duplicados)
})
export class AIModule {}
