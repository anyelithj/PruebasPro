import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OllamaClient } from '../../../ai/ollama.client';
import {
  LANGUAGE_NAME_EN,
  type Language,
} from '../../../../shared/domain/language.vo';
import type {
  DraftSection,
  GrammarDraftPort,
} from '../../domain/interfaces/grammar-draft.interface';
import { isSectionType, SECTION_TYPES } from '../../domain/section-type';
// [Adapter GrammarDraftClient · Sprint 10.10 · RF-135]: implementa GrammarDraftPort con el OllamaClient compartido (JSON restringido) y valida la forma del JSON (tipos de sección conocidos, textos acotados) antes de devolverlo; el IPA lo pone después FastAPI | [Patrón]: Adapter + Filter | [Principio]: DIP + DRY (único cliente de Ollama) + Fail Fast | [Paradigma]: POO + funcional

// [Sinónimos de tipo de sección · 2026-10-24]: inglés/español y plurales → tipo canónico de SECTION_TYPES | [Patrón]: Lookup Table
const SECTION_ALIASES: Readonly<Record<string, string>> = {
  use: 'usage',
  uses: 'usage',
  uso: 'usage',
  structure: 'formula',
  affirmative: 'formula',
  afirmativa: 'formula',
  form: 'formula',
  negation: 'negative',
  negativa: 'negative',
  question: 'interrogative',
  questions: 'interrogative',
  interrogativa: 'interrogative',
  notes: 'note',
  nota: 'note',
  errors: 'common_errors',
  mistakes: 'common_errors',
  common_mistakes: 'common_errors',
  errores_comunes: 'common_errors',
};
// [sectionType]: "Common Errors" → "common_errors" → alias → tipo (o el valor original si no se reconoce: el filtro lo descarta)
const sectionType = (v: unknown): unknown => {
  if (typeof v !== 'string') return v;
  const k = v
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_'); // `replace` con RegExp: espacios y guiones → «_»
  return SECTION_ALIASES[k] ?? k;
};
// [textOf]: cadena o lista de cadenas → texto ("" si no hay texto) | `Array.isArray` + type guard
const textOf = (v: unknown): string =>
  typeof v === 'string'
    ? v.trim()
    : Array.isArray(v)
      ? v
          .filter((x): x is string => typeof x === 'string')
          .join(' ')
          .trim()
      : '';

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
    const lang = LANGUAGE_NAME_EN[input.language as Language] ?? input.language;
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
    // [2026-10-24 · Tolerancia de forma]: los modelos pequeños escriben el tipo con mayúsculas o sinónimos ("Usage", "questions"), el cuerpo como lista
    // de frases y los ejemplos como objetos {"text": …} → antes TODAS las secciones se descartaban y la ficha fallaba con 503 | [Patrón]: Normalizer
    const sections: DraftSection[] = (
      Array.isArray(raw.sections) ? raw.sections : []
    )
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
      // Anotación de retorno (TS): conserva title/examples del objeto original junto a type/body normalizados
      .map((x): Record<string, unknown> & { type: unknown; body: string } => ({
        ...x,
        type: sectionType(x.type),
        body: textOf(x.body),
      }))
      .filter((x) => isSectionType(x.type) && !!x.body)
      .slice(0, 8)
      .map((x) => ({
        type: x.type as DraftSection['type'],
        title: String(x.title ?? '').slice(0, 120),
        body: x.body.slice(0, 4000),
        examples: (Array.isArray(x.examples) ? x.examples : [])
          .map((e) =>
            e && typeof e === 'object' ? (e as { text?: unknown }).text : e,
          ) // {"text": "I work."} → "I work."
          .filter((e): e is string => typeof e === 'string' && !!e.trim())
          .map((e) => e.trim().slice(0, 600))
          .slice(0, 6),
      }));
    if (!sections.length)
      throw new ServiceUnavailableException(
        'La IA no devolvió secciones válidas. Intenta de nuevo.',
      );
    return {
      summary: (textOf(raw.summary) || String(raw.summary ?? '')).slice(0, 600),
      sections,
      model: this.model,
    };
  }
}
