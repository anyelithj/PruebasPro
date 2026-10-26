import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OllamaClient } from '../../../ai/ollama.client';
import {
  CEFR_LEVEL_LABEL_ES,
  type CefrLevel,
} from '../../../../shared/domain/cefr-level.vo';
import {
  LANGUAGE_NAME_EN,
  type Language,
} from '../../../../shared/domain/language.vo';
import type {
  ReadingDraft,
  ReadingDraftPort,
  ReadingDraftRequest,
} from '../../domain/interfaces/reading-draft.interface';
import { READING_GENRE_PROMPT, ReadingGenre } from '../../domain/reading-genre';
import {
  inTargetLanguage,
  strictLine,
} from '../../../../shared/domain/target-language';
import { splitParagraphs } from '../../domain/sentence-splitter';
// [Adapter ReadingDraftClient · Lectura · 2026-10-25]: implementa ReadingDraftPort con el OllamaClient compartido (JSON restringido) y NORMALIZA la forma del JSON antes de devolverlo | [Patrón]: Adapter + Normalizer + Strategy por género (READING_GENRE_PROMPT) | [Principio]: DIP + DRY (único cliente de Ollama) + Fail Fast | [Paradigma]: POO + funcional

const MAX_PARAGRAPHS = 40;
const MAX_PARAGRAPH_CHARS = 4000;
// [Vocabulario por nivel]: guía corta para que el modelo pequeño ajuste la dificultad
const LEVEL_HINT: Readonly<Record<string, string>> = {
  A1: 'very short simple sentences, present tense, the 500 most common words',
  A2: 'short sentences, present and past tense, everyday vocabulary',
  B1: 'clear connected sentences, common tenses, some linking words',
  B2: 'varied sentences, some idioms and complex structures',
  C1: 'rich vocabulary, complex sentences and nuance',
  C2: 'native-like, literary or journalistic style',
};

// [parseLoose]: JSON.parse y, si falla, el primer bloque {…} de la respuesta (algunos modelos añaden texto o ```json) | Función pura | null = no es JSON
export function parseLoose(
  raw: string | undefined,
): Record<string, unknown> | null {
  const text = (raw ?? '').trim();
  const attempt = (s: string): Record<string, unknown> | null => {
    try {
      const v: unknown = JSON.parse(s);
      return v && typeof v === 'object' && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  };
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  return (
    attempt(text) ??
    (first >= 0 && last > first ? attempt(text.slice(first, last + 1)) : null)
  );
}

// [paragraphsOf]: tolera las formas que devuelven los modelos pequeños → lista de párrafos limpios | Función pura
// {"paragraphs":["…"]} · {"paragraphs":[{"text":"…"}]} · {"paragraphs":[["verso","verso"]]} · {"text":"…\n\n…"} · {"body"|"content"|"story"|"poem":"…"}
export function paragraphsOf(
  raw: Record<string, unknown>,
  verse: boolean,
): string[] {
  const asText = (v: unknown): string =>
    typeof v === 'string'
      ? v
      : Array.isArray(v)
        ? v.filter((x): x is string => typeof x === 'string').join('\n')
        : v && typeof v === 'object'
          ? asText(
              (v as { text?: unknown; content?: unknown }).text ??
                (v as { content?: unknown }).content,
            )
          : '';
  const list = Array.isArray(raw.paragraphs)
    ? raw.paragraphs.map(asText)
    : Array.isArray(raw.stanzas)
      ? raw.stanzas.map(asText)
      : [];
  const fallback = asText(
    raw.text ?? raw.body ?? raw.content ?? raw.story ?? raw.poem ?? raw.article,
  );
  // Una lista con párrafos → cada uno se limpia (en verso se conservan los saltos) · un solo texto → se divide por líneas en blanco
  const paragraphs = (list.some((p) => p.trim()) ? list : [fallback]).flatMap(
    (p) => splitParagraphs(p, verse),
  );
  return (verse ? paragraphs : groupLoneSentences(paragraphs))
    .slice(0, MAX_PARAGRAPHS)
    .map((p) => p.slice(0, MAX_PARAGRAPH_CHARS));
}

// [groupLoneSentences · 2026-10-25]: el modelo pequeño a veces devuelve UNA frase por «párrafo» → se agrupan de 3 en 3 (prosa) | Función pura
export function groupLoneSentences(paragraphs: string[], size = 3): string[] {
  const lone = paragraphs.filter(
    (p) => (p.match(/[.!?…](\s|$)/g)?.length ?? 0) <= 1,
  ).length;
  if (paragraphs.length <= 3 || lone < paragraphs.length * 0.7)
    return paragraphs;
  return Array.from({ length: Math.ceil(paragraphs.length / size) }, (_, i) =>
    paragraphs.slice(i * size, i * size + size).join(' '),
  );
}

@Injectable()
export class ReadingDraftClient implements ReadingDraftPort {
  private readonly model: string;

  constructor(
    private readonly ollama: OllamaClient,
    config: ConfigService,
  ) {
    // [Mismo modelo compacto que los demás borradores] (práctica, currículo, diálogos, gramática)
    this.model =
      config.get<string>('OLLAMA_CURRICULUM_MODEL') ??
      config.get<string>('OLLAMA_QWEN_MODEL') ??
      'qwen2.5:3b';
  }

  // [2026-10-25]: respuesta en español → un reintento con orden estricta de idioma
  draft(req: ReadingDraftRequest): Promise<ReadingDraft> {
    return inTargetLanguage(
      req.language,
      (strict) => this.once(req, strict),
      (d) => d.paragraphs.join(' '),
    );
  }

  private async once(
    req: ReadingDraftRequest,
    strict: boolean,
  ): Promise<ReadingDraft> {
    const lang = LANGUAGE_NAME_EN[req.language as Language] ?? req.language;
    const level = CEFR_LEVEL_LABEL_ES[req.level as CefrLevel] ?? req.level;
    const verse = req.genre === ReadingGenre.POEM;
    const words = Math.min(Math.max(Math.round(req.words), 60), 600);
    const source = req.sourceText?.trim();
    const prompt = [
      ...(strict ? [strictLine(req.language)] : []),
      source
        ? `Adapt the following material into ${READING_GENRE_PROMPT[req.genre]} written ONLY in ${lang} for learners at CEFR ${req.level} (${level}). Keep its facts; simplify to the level.`
        : `Write an ORIGINAL ${READING_GENRE_PROMPT[req.genre]} in ${lang} for learners at CEFR ${req.level} (${level}) about "${req.topic}".`,
      `Language level: ${LEVEL_HINT[req.level] ?? LEVEL_HINT.A2}. About ${words} words in total, ${verse ? '2-5 stanzas' : '2-5 paragraphs; EACH paragraph has 2-5 sentences (never one sentence per paragraph)'}.`,
      `The text MUST be entirely in ${lang} (no translations, no IPA). The "title" in ${lang}; the "summary" is ONE sentence in SPANISH.`,
      `Return ONLY JSON: {"title":"...","summary":"...","paragraphs":["${verse ? 'verse 1\\nverse 2' : 'paragraph 1'}","..."]}.`,
      ...(source ? [`Material:\n${source.slice(0, 6000)}`] : []),
    ].join('\n');
    // [num_predict]: ~2 tokens por palabra (+ JSON) con techo → textos largos sin cortar el JSON a la mitad
    const res = await this.ollama.generate({
      model: this.model,
      prompt,
      options: {
        temperature: 0.7,
        num_predict: Math.min(words * 3 + 300, 2400),
        num_ctx: 8192,
      },
    });
    const raw = parseLoose(res.response);
    if (!raw)
      throw new ServiceUnavailableException(
        'La IA devolvió un borrador inválido. Intenta de nuevo.',
      );
    const paragraphs = paragraphsOf(raw, verse);
    if (!paragraphs.length)
      throw new ServiceUnavailableException(
        'La IA no devolvió texto utilizable. Intenta de nuevo o cambia el tema.',
      );
    return {
      title: (typeof raw.title === 'string' ? raw.title.trim() : '').slice(
        0,
        160,
      ),
      summary: (typeof raw.summary === 'string'
        ? raw.summary.trim()
        : ''
      ).slice(0, 600),
      paragraphs,
      model: this.model,
    };
  }
}
