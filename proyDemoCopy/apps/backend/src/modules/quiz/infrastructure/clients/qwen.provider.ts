import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OllamaClient } from '../../../ai/ollama.client';
import { BaseOllamaAIProvider } from './base-ollama-ai.provider';
import {
  AIProvider,
  AI_PROVIDER_MODEL,
} from '../../domain/value-objects/ai-provider.vo';
// [Adapter Qwen]: motor de generación de preguntas vía Ollama local; `think:false` para Qwen3 lo aplica OllamaClient | [Patrón]: Adapter (Hexagonal) + Concrete Strategy | [Principio]: SRP + LSP | [Paradigma]: POO

@Injectable()
export class QwenProvider extends BaseOllamaAIProvider {
  readonly id = AIProvider.QWEN;
  protected readonly model: string;

  constructor(ollama: OllamaClient, config: ConfigService) {
    // [DI]: cliente compartido del módulo AI + configuración
    super(ollama, config); // `super(...)` (ES2015): inicializa la clase base con el cliente compartido
    // [Override por env]: permite usar tag distinto (ej qwen3:14b) sin recompilar | [Principio]: OCP
    this.model =
      this.config.get<string>('OLLAMA_QWEN_MODEL') ??
      AI_PROVIDER_MODEL[AIProvider.QWEN];
  }
}
