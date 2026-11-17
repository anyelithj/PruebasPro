import { nounRulePrompt } from '../../../../shared/domain/noun-rule.prompt';
import { Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { NounGrammarService } from '../../../../shared/noun-grammar/noun-grammar.service';
import { grammarNote, termWithArticle } from '../../../curriculum/domain/content/vocabulary-grammar';
import { ConfigService } from '@nestjs/config';
import { OllamaClient } from '../../../ai/ollama.client';
import { CONCEPT_KINDS } from '../../domain/entities/polyglot-concept.entity';
import type {
  DraftConcept,
  PolyglotDraftPort,
} from '../../domain/interfaces/polyglot-draft.interface';
// [Adapter PolyglotDraftClient · Sprint 10.6 · RF-132]: implementa PolyglotDraftPort con el OllamaClient compartido (JSON restringido) — solo términos y emoji; el IPA lo pone después FastAPI LanguageTools (EnrichTerms) | [Patrón]: Adapter + Filter | [Principio]: DIP + DRY (único cliente de Ollama) + determinístico primero | [Paradigma]: POO + funcional

const LANGS = ['en', 'de', 'fr', 'pt', 'ru', 'zh', 'es'] as const;
const ARTICLE_LANGS = ['de', 'fr', 'pt', 'es', 'en', 'ru', 'zh'] as const; // [2026-11-06]: artículo en la palabra · [2026-11-16]: + ru (género, plural) y zh (clasificador, pinyin) para la nota gramatical

// [Escritura por idioma · 2026-10-31]: cada letra debe ser de su alfabeto (`\P{L}` admite espacios y signos) | detecta mezclas reales del modelo como «сnow» | Regex Unicode (ES2018)
const SCRIPT: Readonly<Record<string, RegExp>> = { ru: /^[\P{L}\p{Script=Cyrillic}]+$/u, zh: /^[\P{L}\p{Script=Han}]+$/u };
const LATIN = /^[\P{L}\p{Script=Latin}]+$/u;
// [meaningKey]: significado sin mayúsculas, tildes ni espacios sobrantes → compara repetidos | Función pura
const meaningKey = (s: string): string =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

// [cleanConcepts · 2026-10-31]: sin significados repetidos ni ya usados en el tema, y sin términos en otro alfabeto (quedan como hueco para el docente) | [Patrón]: Filter | [Paradigma]: Funcional (exportada para pruebas)
export function cleanConcepts<T extends { gloss: string; terms: Record<string, string> }>(
  concepts: readonly T[],
  exclude: readonly string[] = [],
): T[] {
  const seen = new Set(exclude.map(meaningKey)); // `Set` (ES2015): significados ya vistos en O(1)
  return concepts.flatMap((c) => {
    const key = meaningKey(c.gloss);
    if (!key || seen.has(key)) return [];
    seen.add(key);
    const terms = Object.fromEntries(
      Object.entries(c.terms).filter(([lang, text]) => (SCRIPT[lang] ?? LATIN).test(text)),
    );
    return [{ ...c, terms }];
  });
}

@Injectable()
export class PolyglotDraftClient implements PolyglotDraftPort {
  private readonly model: string;

  constructor(
    private readonly ollama: OllamaClient,
    config: ConfigService,
    @Optional() private readonly nouns?: NounGrammarService, // [2026-11-06]: artículo de cada sustantivo al generar
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
      `Topic (in Spanish): "${input.topic}". Translate the topic to English in "topic_en", then list ${input.count} different ${what} for language learners.`,
      // [Fix 2026-10-31 · relevancia]: el modelo añadía palabras vagamente asociadas («fuego» y «agua» en «El clima») → criterio explícito de pertenencia
      'Every item must belong directly to this exact topic, as in a textbook chapter about it. Exclude generic words that are only loosely associated. Each item must have a different meaning.',
      `For each one give the equivalent in these languages: ${LANGS.join(', ')} (zh in simplified Chinese characters, ru in Cyrillic).`,
      input.exclude.length
        ? `Do NOT repeat these meanings: ${input.exclude.slice(0, 60).join(', ')}.`
        : '',
      'Return ONLY JSON: {"topic_en":"...","concepts":[{"emoji":"one emoji","gloss":"meaning in Spanish","terms":{"en":"...","de":"...","fr":"...","pt":"...","ru":"...","zh":"...","es":"..."}}]}.',
      // [2026-11-03 · Regla obligatoria de vocabulario]: sustantivos con artículo (de/fr/pt/es), clasificador (zh), sin artículo (ru)
      'Use the singular base form. Never invent IPA.',
      ...LANGS.map((l) => nounRulePrompt(l)).filter(Boolean),
    ]
      .filter(Boolean)
      .join('\n');
    const res = await this.ollama.generate({
      model: this.model,
      prompt,
      options: { temperature: 0.2, num_predict: 1800, num_ctx: 4096 }, // [2026-10-31]: 0.3 → 0.2, menos deriva fuera del tema
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
    const parsed = (Array.isArray(list) ? list : [])
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
      }));
    const concepts = cleanConcepts(parsed, input.exclude).slice(0, input.count);
    if (input.kind === 'word' && this.nouns) await this.withArticles(concepts);
    return { concepts, model: this.model };
  }

  // [withArticles · 2026-11-06 · Regla obligatoria]: de/fr/pt/es (+ en a/an) → un lote por idioma con /noun-grammar/batch · ru y zh no llevan artículo | fallo → términos tal cual
  private async withArticles(concepts: DraftConcept[]): Promise<void> {
    await Promise.all(
      ARTICLE_LANGS.map(async (lang) => {
        const idx = concepts.map((c, i) => (c.terms[lang]?.trim() ? i : -1)).filter((i) => i >= 0);
        if (!idx.length) return;
        const g = await this.nouns!.many(idx.map((i) => concepts[i]!.terms[lang]!), lang);
        idx.forEach((i, k) => {
          const c = concepts[i]!;
          c.terms[lang] = termWithArticle(lang, c.terms[lang]!, g[k] ?? null);
          (c.grammar ??= {})[lang] = grammarNote(lang, g[k] ?? null); // [2026-11-16]: plural, género, contable… (regla obligatoria)
        });
      }),
    );
  }
}
