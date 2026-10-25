// [STRATEGY] selecciona el provider IA en runtime — extensible sin tocar ChatService
import { Injectable } from '@nestjs/common';
import { AiProvider } from '../strategy/ai-provider.interface';
import { LlamaindexRagStrategy } from '../strategy/llamaindex-rag.strategy';
import { OllamaLangchainStrategy } from '../strategy/ollama-langchain.strategy';

@Injectable()
export class AiProviderService {
  private readonly registry: Map<string, AiProvider>;

  constructor(
    private readonly ollama: OllamaLangchainStrategy,
    private readonly rag: LlamaindexRagStrategy,
  ) {
    this.registry = new Map<string, AiProvider>([
      [ollama.name, ollama],
      [rag.name, rag],
    ]);
  }

  get(name: string): AiProvider {
    return this.registry.get(name) ?? this.ollama;
  }
}
