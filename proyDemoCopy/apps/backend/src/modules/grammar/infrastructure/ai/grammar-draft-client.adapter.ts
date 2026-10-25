import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OllamaClient } from '../../../ai/ollama.client';
import { LANGUAGE_LABEL, type Language } from '../../../../shared/domain/language.vo';
import type {
  DraftSection,
  GrammarDraftPort,
} from '../../domain/interfaces/grammar-draft.interface';
import { isSectionType, SECTION_TYPES } from '../../domain/section-type';
// [Adapter GrammarDraftClient · Sprint 10.10 · RF-135]: implementa GrammarDraftPort con el OllamaClient compartido (JSON restringido) y valida la forma del JSON (tipos de sección conocidos, textos acotados) antes de devolverlo; el IPA lo pone después FastAPI | [Patrón]: Adapter + Filter | [Principio]: DIP + DRY (único cliente de Ollama) + Fail Fast | [Paradigma]: POO + funcional

@Injectable()
export class GrammarDraftClient implements GrammarDraftPort {
  private readonly model: string;

  constructor(
    private readonly ollama: OllamaClient,
    config: ConfigService,
  ) {
    this.model =
      config.get<string>('OLLAMA_CURRICULUM_MODEL') ??
      config.get<string>('OLLAMA_QWEN_MODEL') ??
      'qwen2.5:3b';
  }

  async draft(input: { title: string; language: string; level: string }) {
    const lang = LANGUAGE_LABEL[input.language as Language] ?? input.language;
    const prompt = [
      `Write an ORIGINAL grammar sheet about "${input.title}" for learners of ${lang} (CEFR ${input.level}).`,
      'Explanations, titles and the summary in SPANISH; examples in the studied language only (short, natural sentences).',
      `Section types (use them in this order when they apply): ${SECTION_TYPES.join(', ')}.`,
      '"formula" body is a short pattern like "Sujeto + verbo + complemento". Give 2-4 examples for usage, formula, negative and interrogative.',
      'Return ONLY JSON: {"summary":"...","sections":[{"type":"usage","title":"...","body":"...","examples":["..."]}]}. Never include IPA.',
    ].join('\n');
    const res = await this.ollama.generate({
      model: this.model,
      prompt,
      options: { temperature: 0.3, num_predict: 1800, num_ctx: 4096 },
    });
    let raw: { summary?: unknown; sections?: unknown };
    try {
      raw = JSON.parse(res.response ?? '{}') as typeof raw;
    } catch {
      throw new ServiceUnavailableException(
        'La IA devolvió un borrador inválido. Intenta de nuevo.',
      );
    }
    // [Validación]: solo secciones de tipo conocido con texto; ejemplos como cadenas cortas
    const sections: DraftSection[] = (Array.isArray(raw.sections) ? raw.sections : [])
      .map((x) => x as Record<string, unknown>)
      .filter((x) => isSectionType(x.type) && typeof x.body === 'string')
      .slice(0, 8)
      .map((x) => ({
        type: x.type as DraftSection['type'],
        title: String(x.title ?? '').slice(0, 120),
        body: String(x.body).slice(0, 4000),
        examples: (Array.isArray(x.examples) ? x.examples : [])
          .filter((e): e is string => typeof e === 'string' && !!e.trim())
          .map((e) => e.trim().slice(0, 600))
          .slice(0, 6),
      }));
    if (!sections.length)
      throw new ServiceUnavailableException(
        'La IA no devolvió secciones válidas. Intenta de nuevo.',
      );
    return {
      summary: String(raw.summary ?? '').slice(0, 600),
      sections,
      model: this.model,
    };
  }
}
