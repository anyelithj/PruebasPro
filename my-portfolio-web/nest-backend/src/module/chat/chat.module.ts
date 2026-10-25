// [FACADE] chat bounded context — IA open source (Ollama) + RAG (delegado a FastAPI).
import { Module } from '@nestjs/common';
import { ChatController } from './controller/chat.controller';
import { ChatGateway } from './controller/chat.gateway';
import { ChatRepository } from './repository/chat.repository';
import { AiProviderService } from './service/ai-provider.service';
import { ChatService } from './service/chat.service';
import { LlamaindexRagStrategy } from './strategy/llamaindex-rag.strategy';
import { OllamaLangchainStrategy } from './strategy/ollama-langchain.strategy';

@Module({
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatRepository,
    AiProviderService,
    OllamaLangchainStrategy,
    LlamaindexRagStrategy,
    ChatGateway,
  ],
  exports: [ChatService],
})
export class ChatModule {}
