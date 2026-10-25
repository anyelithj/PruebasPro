import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { nsToMs, OllamaClient } from '../../../ai/ollama.client';
import type {
  CurriculumLlm,
  LlmMetrics,
  LlmResult,
} from '../../domain/interfaces/curriculum-llm.interface';
// [Adapter Ollama para Curriculum]: implementa el puerto CurriculumLlm reutilizando OllamaClient (módulo AI) y devuelve MÉTRICAS REALES de cada inferencia | [Patrón]: Adapter (Hexagonal) + Delegation | [Principio]: SRP + LSP + DIP + DRY | [Paradigma]: POO + async/await
// [Tecnología]: NestJS DI + OllamaClient (API REST de Ollama: /api/generate, /api/show, /api/ps)

// `@Injectable()` (NestJS): el contenedor DI lo entrega como implementación del token CURRICULUM_LLM
@Injectable()
export class OllamaCurriculumLlm implements CurriculumLlm {
  private readonly model: string; // Modelo compacto para borradores curriculares

  constructor(
    private readonly ollama: OllamaClient, // [DI]: cliente compartido (@Global) → sin cliente HTTP propio | [Principio]: DRY
    config: ConfigService,
  ) {
    // [Modelo compacto configurable]: OLLAMA_CURRICULUM_MODEL o el de Qwen (la especificación prioriza modelos locales cuantizados)
    this.model =
      config.get<string>('OLLAMA_CURRICULUM_MODEL') ??
      config.get<string>('OLLAMA_QWEN_MODEL') ??
      'qwen2.5:3b';
  }

  // [generateJson]: una inferencia JSON + métricas del modelo y de la memoria | [Patrón]: Adapter
  async generateJson(prompt: string, maxTokens: number, temperature = 0.3): Promise<LlmResult> {
    const res = await this.ollama.generate({
      model: this.model,
      prompt,
      options: {
        temperature,
        top_p: 0.9,
        num_predict: maxTokens,
        num_ctx: 4096,
      }, // Temperatura baja: contenido consistente
    });
    let data: unknown; // `unknown` (TS): obliga a validar con Zod en la capa de aplicación
    try {
      data = JSON.parse(res.response ?? '{}'); // `JSON.parse` (JS): lanza SyntaxError si el modelo no respetó el formato
    } catch {
      throw new ServiceUnavailableException(
        `IA no disponible (${this.model}): el modelo devolvió un JSON inválido. Intenta de nuevo.`,
      );
    }
    // [Métricas]: info del modelo y memoria en paralelo (`Promise.all`, ES2015); si fallan, quedan en null
    const [info, ps] = await Promise.all([
      this.ollama.showModel(this.model),
      this.ollama.memory(),
    ]);
    const loaded = ps?.models?.find(
      (m) => m.name === this.model || m.model === this.model,
    );
    const metrics: LlmMetrics = {
      model: this.model,
      modelDigest: loaded?.digest ?? null,
      quantization: info?.details?.quantization_level ?? null,
      parameterSize: info?.details?.parameter_size ?? null,
      promptTokens: res.prompt_eval_count ?? null,
      outputTokens: res.eval_count ?? null,
      latencyMs: nsToMs(res.total_duration),
      loadMs: nsToMs(res.load_duration),
      ramBytes: loaded?.size ?? null,
      vramBytes: loaded?.size_vram ?? null,
    };
    return { data, metrics };
  }
}
