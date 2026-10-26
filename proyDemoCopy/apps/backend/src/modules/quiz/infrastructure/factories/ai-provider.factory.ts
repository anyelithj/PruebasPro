import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AIProvider,
  AI_PROVIDER_LABEL,
  DEFAULT_AI_PROVIDER,
  FALLBACK_AI_PROVIDER,
} from '../../domain/value-objects/ai-provider.vo';
import type {
  AIGeneratedQuestion,
  GenerateAIQuestionsOptions,
  IAIQuestionProvider,
} from '../../domain/interfaces/ai-question-provider.interface';
import { AyaProvider } from '../clients/aya.provider';
import { QwenProvider } from '../clients/qwen.provider';
import { MistralProvider } from '../clients/mistral.provider';
// [Factory + Fallback opcional]: enruta al provider elegido; el fallback a otro modelo solo se activa por configuración | [Patrón]: Factory + Registry + Chain of Responsibility + Strategy | [Principio]: OCP + DIP | [Paradigma]: POO + async/await
// [Eficiencia]: por defecto NO hay fallback cruzado → nunca se cargan dos modelos de ~5 GB a la vez en un equipo de 8 GB.

@Injectable()
export class AIProviderFactory {
  private readonly logger = new Logger(AIProviderFactory.name); // Logger de NestJS con contexto de clase
  // `ReadonlyMap` (TS): registro id → instancia que no se puede mutar tras construirse | [Patrón]: Registry
  private readonly registry: ReadonlyMap<AIProvider, IAIQuestionProvider>;
  private readonly fallbackEnabled: boolean; // Leído una sola vez en el arranque

  constructor(
    aya: AyaProvider,
    qwen: QwenProvider,
    mistral: MistralProvider,
    config: ConfigService, // `ConfigService` (@nestjs/config): lee variables de entorno tipadas
  ) {
    this.registry = new Map<AIProvider, IAIQuestionProvider>([
      [AIProvider.AYA, aya],
      [AIProvider.QWEN, qwen],
      [AIProvider.MISTRAL, mistral],
    ]);
    // `=== 'true'`: comparación estricta; cualquier otro valor (o ausencia) desactiva el fallback → seguro por defecto
    this.fallbackEnabled = config.get<string>('AI_FALLBACK_ENABLED') === 'true';
    this.warnSharedModels();
  }

  // [2026-10-24 · Diagnóstico]: si OLLAMA_AYA/QWEN/MISTRAL_MODEL apuntan al mismo tag, los «tres motores» son en realidad UNO → si ese modelo no cabe en RAM fallan los tres igual
  // (el respaldo real lo da OllamaClient con OLLAMA_FALLBACK_MODELS) | [Patrón]: Fail Loud en el arranque
  private warnSharedModels(): void {
    const byModel = new Map<string, string[]>(); // `Map` (ES2015): tag → motores que lo usan
    for (const [id, p] of this.registry) {
      if (!p.modelTag) continue;
      byModel.set(p.modelTag, [
        ...(byModel.get(p.modelTag) ?? []),
        AI_PROVIDER_LABEL[id],
      ]);
    }
    for (const [model, engines] of byModel)
      if (engines.length > 1)
        this.logger.warn(
          `Los motores ${engines.join(', ')} usan el mismo modelo "${model}": elegir otro motor no cambia el resultado. Configura OLLAMA_*_MODEL distintos o OLLAMA_FALLBACK_MODELS.`,
        );
  }

  // [sameModel]: dos motores con el mismo tag → probar el segundo tras fallar el primero es repetir el mismo fallo
  private sameModel(a: AIProvider, b: AIProvider): boolean {
    const ma = this.registry.get(a)?.modelTag;
    return !!ma && ma === this.registry.get(b)?.modelTag;
  }

  // [Selector]: resuelve provider por id | [Patrón]: Factory Method
  get(provider: AIProvider): IAIQuestionProvider {
    const instance = this.registry.get(provider);
    if (!instance) throw new Error(`AI provider no registrado: ${provider}`);
    return instance;
  }

  // [Generación]: intenta el preferido; solo prueba el siguiente eslabón si el fallback está habilitado
  async generateWithFallback(
    options: GenerateAIQuestionsOptions,
    preferred: AIProvider = DEFAULT_AI_PROVIDER, // Parámetro con valor por defecto (ES2015)
  ): Promise<{
    questions: AIGeneratedQuestion[];
    usedProvider: AIProvider;
    fallbackUsed: boolean;
  }> {
    const chain = this.buildChain(preferred);
    let lastError: unknown; // `unknown` (TS): obliga a comprobar el tipo antes de usarlo

    // `for...of` (ES2015): recorre la cadena en orden; `continue` salta al siguiente eslabón
    for (const providerId of chain) {
      const provider = this.registry.get(providerId);
      if (!provider) continue;
      try {
        const questions = await provider.generateQuestions(options);
        // [Quality Gate]: 0 preguntas válidas cuenta como fallo del eslabón
        if (questions.length === 0) {
          lastError = new Error(
            `${AI_PROVIDER_LABEL[providerId]} no devolvió preguntas válidas (formato JSON inesperado del modelo)`,
          );
          this.logger.warn(
            `Provider ${AI_PROVIDER_LABEL[providerId]} devolvió 0 preguntas válidas.`,
          );
          continue;
        }
        const fallbackUsed = providerId !== preferred;
        if (fallbackUsed) {
          this.logger.warn(
            `Fallback activado: ${AI_PROVIDER_LABEL[providerId]} en lugar de ${AI_PROVIDER_LABEL[preferred]}`,
          );
        }
        return { questions, usedProvider: providerId, fallbackUsed };
      } catch (err) {
        lastError = err;
        this.logger.error(
          `Provider ${AI_PROVIDER_LABEL[providerId]} falló: ${(err as Error).message}`,
        );
      }
    }

    // [Cadena agotada]: error con la causa real para que el caso de uso responda 503 con contexto
    throw new ServiceUnavailableException(
      `No se pudieron generar preguntas. Último error: ${(lastError as Error)?.message ?? 'desconocido'}. Verifica Ollama y el modelo instalado.`,
    );
  }

  // [Cadena]: [preferido] o [preferido, alternativo] si AI_FALLBACK_ENABLED=true | función sin efectos secundarios
  private buildChain(preferred: AIProvider): AIProvider[] {
    if (!this.fallbackEnabled) return [preferred];
    const alternative =
      preferred !== FALLBACK_AI_PROVIDER
        ? FALLBACK_AI_PROVIDER
        : DEFAULT_AI_PROVIDER;
    return alternative === preferred || this.sameModel(preferred, alternative)
      ? [preferred]
      : [preferred, alternative];
  }
}
