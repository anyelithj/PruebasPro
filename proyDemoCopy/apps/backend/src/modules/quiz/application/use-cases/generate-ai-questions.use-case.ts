import { Injectable, Logger } from '@nestjs/common';
import { AIProviderFactory } from '../../infrastructure/factories/ai-provider.factory';
import type {
  AIGeneratedQuestion,
  GenerateAIQuestionsOptions,
} from '../../domain/interfaces/ai-question-provider.interface';
import { DEFAULT_AI_PROVIDER } from '../../domain/value-objects/ai-provider.vo';
import { DEFAULT_LANGUAGE } from '../../domain/value-objects/language.vo';
import { GenerateAIQuestionsDto } from '../dtos/generate-ai-questions.dto';
// [Use Case GenerateAIQuestions]: orquesta factory + fallback | [Patrón]: Command | [Principio]: SRP + DIP | [Paradigma]: POO

// [Forma respuesta]: incluye trazabilidad de provider usado y si hubo fallback | [Principio]: ISP
export interface GenerateAIQuestionsResult {
  questions: AIGeneratedQuestion[];
  usedProvider: string;
  fallbackUsed: boolean;
}

@Injectable()
export class GenerateAIQuestionsUseCase {
  private readonly logger = new Logger(GenerateAIQuestionsUseCase.name);
  // [Reintentos de relleno]: el LLM local a veces devuelve menos preguntas de las pedidas; pedimos las faltantes hasta MAX_ATTEMPTS | [Patrón]: Top-up Loop
  private readonly MAX_ATTEMPTS = 3;

  constructor(private readonly factory: AIProviderFactory) {}

  // [Sin caché]: cada solicitud genera preguntas frescas. Cachear producía resultados repetidos (duplicados al generar 2da vez en el mismo examen) y servía datos obsoletos | [Patrón]: Always Fresh
  async execute(
    dto: GenerateAIQuestionsDto,
  ): Promise<GenerateAIQuestionsResult> {
    const language = dto.language ?? DEFAULT_LANGUAGE;
    const preferred = dto.provider ?? DEFAULT_AI_PROVIDER;
    const target = dto.amount;

    const baseOptions: GenerateAIQuestionsOptions = {
      topic: dto.topic,
      amount: target,
      category: dto.category,
      difficulty: dto.difficulty,
      type: dto.type,
      language,
    };

    // [Acumulación con dedup]: combina varios intentos hasta alcanzar la cantidad pedida, sin repetir enunciados | [Patrón]: Top-up Loop + Dedup
    const collected: AIGeneratedQuestion[] = [];
    const seen = new Set<string>();
    let usedProvider = preferred as string;
    let fallbackUsed = false;
    let attempts = 0;
    let lastError: unknown;

    while (collected.length < target && attempts < this.MAX_ATTEMPTS) {
      attempts++;
      const remaining = target - collected.length;
      try {
        const result = await this.factory.generateWithFallback(
          { ...baseOptions, amount: remaining },
          preferred,
        );
        usedProvider = result.usedProvider;
        fallbackUsed = fallbackUsed || result.fallbackUsed;

        let added = 0;
        for (const q of result.questions) {
          const key = q.text.trim().toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          collected.push(q);
          added++;
          if (collected.length >= target) break;
        }
        // [Sin progreso]: el modelo no aporta preguntas nuevas; evitar bucle infinito | [Patrón]: Stagnation Guard
        if (added === 0) break;
      } catch (err) {
        // [Primer intento falla]: propagar (no hay nada que devolver); intentos posteriores → conservar lo acumulado | [Patrón]: Partial Success
        lastError = err;
        if (collected.length === 0) throw err;
        break;
      }
    }

    // `instanceof Error`: solo se lanzan objetos Error (conservan stack trace); cualquier otro valor se envuelve | [Principio]: Fail Fast
    if (collected.length === 0 && lastError)
      throw lastError instanceof Error
        ? lastError
        : new Error(JSON.stringify(lastError));

    const questions = collected.slice(0, target);
    this.logger.log(
      `Generadas ${questions.length}/${target} preguntas AI en ${attempts} intento(s) (provider=${usedProvider}, fallback=${fallbackUsed}, lang=${language})`,
    );
    return { questions, usedProvider, fallbackUsed };
  }
}
