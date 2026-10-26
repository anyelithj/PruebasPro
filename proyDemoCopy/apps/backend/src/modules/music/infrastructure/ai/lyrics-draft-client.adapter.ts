import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OllamaClient } from '../../../ai/ollama.client';
import { LANGUAGE_NAME_EN, type Language } from '../../../../shared/domain/language.vo';
import type {
  LyricsDraft,
  LyricsDraftInput,
  LyricsDraftPort,
} from '../../domain/interfaces/lyrics-draft.interface';
// [Adapter LyricsDraftClient · 2026-10-24 · RF-117]: implementa LyricsDraftPort con el OllamaClient compartido (salida JSON restringida) y valida la forma antes de devolverla; el IPA y la traducción los pone después FastAPI (mismo flujo que una letra pegada)
// [Modelo]: aya-expanse (multilingüe: escribe bien en los siete idiomas, incluidos chino y ruso) — el mismo que ya usa el ai-service → un solo modelo residente en RAM
// [Patrón]: Adapter + Filter (valida y acota el JSON del LLM) | [Principio]: DIP + DRY (único cliente de Ollama) + Fail Fast | [Paradigma]: POO + funcional

const MAX_STANZAS = 8;
const MAX_LINES_PER_STANZA = 8;
const MAX_LINE_CHARS = 120;

// [cleanStanzas]: JSON del LLM → estrofas válidas (cadenas recortadas, sin etiquetas «[Chorus]» ni numeración) | Función pura exportada para las pruebas
export function cleanStanzas(raw: unknown): string[][] {
  return (Array.isArray(raw) ? raw : [])
    .map((st) =>
      (Array.isArray(st) ? st : typeof st === 'string' ? st.split(/\r?\n/) : []) // Algunos modelos devuelven la estrofa como un único string
        .filter((l): l is string => typeof l === 'string') // `l is string` (TS): type guard → el resto del encadenamiento es string[]
        .map((l) => l.replace(/^\s*(\d+[.)]|[-•*])\s*/, '').replace(/\s+/g, ' ').trim())
        .filter((l) => l && !/^\[[^\]]*\]$/.test(l) && !/^\(?(chorus|verse|estribillo|coro|refrain)\b/i.test(l))
        .map((l) => l.slice(0, MAX_LINE_CHARS))
        .slice(0, MAX_LINES_PER_STANZA),
    )
    .filter((st) => st.length)
    .slice(0, MAX_STANZAS);
}

@Injectable()
export class LyricsDraftClient implements LyricsDraftPort {
  private readonly model: string;

  constructor(
    private readonly ollama: OllamaClient,
    config: ConfigService,
  ) {
    this.model =
      config.get<string>('OLLAMA_AYA_MODEL') ??
      config.get<string>('OLLAMA_CURRICULUM_MODEL') ??
      'aya-expanse:8b';
  }

  async draft(input: LyricsDraftInput): Promise<LyricsDraft> {
    const lang = LANGUAGE_NAME_EN[input.language as Language] ?? input.language;
    // [Prompt en inglés]: los modelos siguen mejor las instrucciones en inglés; la LETRA se pide en el idioma estudiado
    const prompt = [
      `Write ORIGINAL song lyrics in ${lang} (language code "${input.language}") for language learners at CEFR level ${input.level}.`,
      `Topic: ${input.topic.trim()}.`,
      input.title ? `Song title: "${input.title.trim()}".` : 'Also propose a short, catchy title in the same language.',
      `Use vocabulary and grammar suitable for ${input.level}; short lines (3-10 words), natural rhythm and simple rhymes; repeat a chorus so learners can sing along.`,
      'Structure: verse, chorus, verse, chorus (optionally a bridge and a final chorus). 4 lines per stanza.',
      'Never copy existing copyrighted songs. Do not translate, do not add IPA, do not label stanzas.',
      'Return ONLY JSON: {"title":"...","stanzas":[["line 1","line 2","line 3","line 4"],["..."]]}.',
    ].join('\n');
    const res = await this.ollama.generate({
      model: this.model,
      prompt,
      options: { temperature: 0.8, top_p: 0.9, num_predict: 900, num_ctx: 2048 },
    });
    let raw: { title?: unknown; stanzas?: unknown };
    try {
      raw = JSON.parse(res.response ?? '{}') as typeof raw;
    } catch {
      throw new ServiceUnavailableException('La IA devolvió una letra inválida. Intenta de nuevo.');
    }
    const stanzas = cleanStanzas(raw.stanzas);
    if (stanzas.flat().length < 4)
      throw new ServiceUnavailableException('La IA no devolvió suficientes versos. Intenta de nuevo o cambia el tema.');
    return {
      title: (input.title?.trim() || String(raw.title ?? '').trim() || input.topic.trim()).slice(0, 160),
      stanzas,
      model: this.model,
    };
  }
}
