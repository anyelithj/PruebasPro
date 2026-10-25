import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OllamaClient } from '../../../ai/ollama.client';
import { BaseOllamaAIProvider } from './base-ollama-ai.provider';
import {
  AIProvider,
  AI_PROVIDER_MODEL,
} from '../../domain/value-objects/ai-provider.vo';
// [Adapter Aya Expanse]: motor principal multilingüe vía Ollama local | [Patrón]: Adapter (Hexagonal) + Concrete Strategy + Template Method (hereda el flujo de la base) | [Principio]: SRP + LSP + OCP | [Paradigma]: POO (herencia)
// [Tecnología]: NestJS DI + Ollama HTTP API (/api/generate)

// `@Injectable()` (NestJS): el contenedor DI crea una única instancia (singleton por defecto)
@Injectable()
// `extends` (ES2015): reutiliza prompt, parser y validación de la clase base → solo cambia identidad y modelo
export class AyaProvider extends BaseOllamaAIProvider {
  readonly id = AIProvider.AYA; // `readonly` (TS): identidad inmutable usada por la factory
  protected readonly model: string; // `protected` (TS): visible para la base (Template Method) pero no desde fuera

  constructor(ollama: OllamaClient, config: ConfigService) {
    // [DI]: cliente compartido del módulo AI + configuración
    super(ollama, config); // `super(...)` (ES2015): inicializa la clase base con el cliente compartido
    // [Override por env]: cambiar tag/cuantización sin recompilar | `??` usa el default si la env no existe
    this.model =
      this.config.get<string>('OLLAMA_AYA_MODEL') ??
      AI_PROVIDER_MODEL[AIProvider.AYA];
  }
}
