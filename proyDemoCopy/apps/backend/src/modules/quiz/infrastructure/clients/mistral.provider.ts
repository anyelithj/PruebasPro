import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OllamaClient } from '../../../ai/ollama.client';
import { BaseOllamaAIProvider } from './base-ollama-ai.provider';
import {
  AIProvider,
  AI_PROVIDER_MODEL,
} from '../../domain/value-objects/ai-provider.vo';
// [Adapter Mistral Nemo]: motor fallback / validación de generación de preguntas vía Ollama local | [Patrón]: Adapter (Hexagonal) + Concrete Strategy | [Principio]: SRP + LSP | [Paradigma]: POO

@Injectable()
export class MistralProvider extends BaseOllamaAIProvider {
  readonly id = AIProvider.MISTRAL;
  protected readonly model: string;

  constructor(ollama: OllamaClient, config: ConfigService) {
    // [DI]: cliente compartido del módulo AI + configuración
    super(ollama, config); // `super(...)` (ES2015): inicializa la clase base con el cliente compartido
    // [Override por env]: permite cambiar tag (ej mistral-nemo:12b-instruct) sin recompilar | [Principio]: OCP
    this.model =
      this.config.get<string>('OLLAMA_MISTRAL_MODEL') ??
      AI_PROVIDER_MODEL[AIProvider.MISTRAL];
  }
}
