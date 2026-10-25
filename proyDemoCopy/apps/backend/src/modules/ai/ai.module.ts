import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { AIClientService } from './ai-client.service';
import { AIController } from './ai.controller';
import { AssistantClientService } from './assistant-client.service';
import { AssistantController } from './assistant.controller';
import { OllamaClient } from './ollama.client';
import { OwnLlmClientService } from './own-llm-client.service';
import { OwnLlmController } from './own-llm.controller';
// [AIModule]: puerta de IA del backend → AIClientService (hacia FastAPI) + OllamaClient (único cliente de Ollama) + controller proxy /ai/feedback/* | [Patron]: Module + DI | [Principio]: ISP + DRY

// `@Global()` (NestJS): los proveedores exportados se inyectan en cualquier módulo sin volver a importarlo
@Global()
@Module({
  imports: [HttpModule.register({ timeout: 30_000, maxRedirects: 2 })],
  controllers: [AIController, AssistantController, OwnLlmController], // [Sprint 5.6]: /ai/own-llm/* (LLM propio)
  providers: [
    AIClientService,
    OllamaClient,
    AssistantClientService,
    OwnLlmClientService,
  ],
  exports: [AIClientService, OllamaClient, AssistantClientService], // [Export]: Quiz, Curriculum y Help (Sprint 7.10) reutilizan los mismos clientes (sin clientes HTTP duplicados)
})
export class AIModule {}
