import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OllamaClient } from '../../../ai/ollama.client';
import { CONCEPT_KINDS } from '../../domain/entities/polyglot-concept.entity';
import type {
  DraftConcept,
  PolyglotDraftPort,
} from '../../domain/interfaces/polyglot-draft.interface';
// [Adapter PolyglotDraftClient · Sprint 10.6 · RF-132]: implementa PolyglotDraftPort con el OllamaClient compartido (JSON restringido) — solo términos y emoji; el IPA lo pone después FastAPI LanguageTools (EnrichTerms) | [Patrón]: Adapter + Filter | [Principio]: DIP + DRY (único cliente de Ollama) + determinístico primero | [Paradigma]: POO + funcional

const LANGS = ['en', 'de', 'fr', 'pt', 'ru', 'zh', 'es'] as const;

@Injectable()
export class PolyglotDraftClient implements PolyglotDraftPort {
  private readonly model: string;

  constructor(
    private readonly ollama: OllamaClient,
    config: ConfigService,
  ) {
    // [Mismo modelo compacto que los borradores de Curriculum y Practice]
    this.model =
      config.get<string>('OLLAMA_CURRICULUM_MODEL') ??
      config.get<string>('OLLAMA_QWEN_MODEL') ??
      'qwen2.5:3b';
  }

  async draft(input: {
    topic: string;
    kind: 'word' | 'phrase';
    count: number;
    exclude: string[];
  }): Promise<{ concepts: DraftConcept[]; model: string }> {
    const what =
      input.kind === 'phrase' ? 'short everyday phrases' : 'common nouns or words';
    const prompt = [
      `Topic (in Spanish): "${input.topic}". List ${input.count} ${what} for language learners about this topic.`,
      `For each one give the equivalent in these languages: ${LANGS.join(', ')} (zh in simplified Chinese characters, ru in Cyrillic).`,
      input.exclude.length
        ? `Do NOT repeat these meanings: ${input.exclude.slice(0, 60).join(', ')}.`
        : '',
      'Return ONLY JSON: {"concepts":[{"emoji":"one emoji","gloss":"meaning in Spanish","terms":{"en":"...","de":"...","fr":"...","pt":"...","ru":"...","zh":"...","es":"..."}}]}.',
      'Use the base form (singular nouns with no article). Never invent IPA.',
    ]
      .filter(Boolean)
      .join('\n');
    const res = await this.ollama.generate({
      model: this.model,
      prompt,
      options: { temperature: 0.3, num_predict: 1800, num_ctx: 4096 },
    });
    let raw: unknown;
    try {
      raw = JSON.parse(res.response ?? '{}');
    } catch {
      throw new ServiceUnavailableException(
        'La IA devolvió un borrador inválido. Intenta de nuevo.',
      );
    }
    const list = (raw as { concepts?: unknown }).concepts;
    // [Filtro]: solo objetos con glosa y términos de texto (el LLM puede devolver basura)
    const concepts = (Array.isArray(list) ? list : [])
      .map((x) => x as Partial<DraftConcept>)
      .filter((x) => typeof x.gloss === 'string' && x.terms && typeof x.terms === 'object')
      .map((x) => ({
        kind: (CONCEPT_KINDS as readonly string[]).includes(input.kind) ? input.kind : 'word',
        emoji: typeof x.emoji === 'string' ? x.emoji : '',
        gloss: String(x.gloss),
        terms: Object.fromEntries(
          Object.entries(x.terms as Record<string, unknown>)
            .filter(([k, v]) => (LANGS as readonly string[]).includes(k) && typeof v === 'string')
            .map(([k, v]) => [k, String(v)]),
        ),
      }))
      .slice(0, input.count);
    return { concepts, model: this.model };
  }
}
