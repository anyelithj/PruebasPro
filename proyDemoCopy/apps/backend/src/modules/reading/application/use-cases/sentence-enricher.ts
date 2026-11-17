import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  LANGUAGE_TOOLS,
  type LanguageToolsPort,
} from '../../../../shared/domain/interfaces/language-tools.interface';
// [SentenceEnricher · Lectura · 2026-10-25]: traducción al español + IPA de muchas frases en LOTES hacia LanguageTools (FastAPI /language-tools/lines) | [Patrón]: Ports & Adapters + Batch + degradación elegante (parcial ante fallos) | [Principio]: SRP + DIP + DRY (mismo puerto que Música, Diálogos y Gramática) | [Paradigma]: POO + async/await
// [Por qué lotes propios]: un lote que falla (LLM ocupado, timeout) no tira los demás → el texto se guarda con lo que sí llegó y el resto se completa luego con «Completar IPA y traducción»

// [Fix 2026-10-31 · «traducción en preparación» eterna]: FastAPI corta la traducción a los 70 s y un lote de 20 frases nunca llegaba (13 de 13 frases sin traducir); medido con qwen2.5:3b en CPU: 3 frases > 60 s, 1 frase 4–7 s (47 s con el modelo en frío)
// 1 frase por petición → cabe siempre y la columna se rellena frase a frase | Subir solo en una máquina con GPU
export const ENRICH_BATCH = 1; // Frases por petición

export interface SentenceLinguistics {
  ipa: string;
  ipaUs: string | null;
  translation: string | null;
}

const EMPTY: SentenceLinguistics = { ipa: '', ipaUs: null, translation: null };

@Injectable()
export class SentenceEnricher {
  private readonly logger = new Logger(SentenceEnricher.name);

  constructor(
    @Inject(LANGUAGE_TOOLS) private readonly tools: LanguageToolsPort,
  ) {}

  // [enrich]: misma longitud y orden que `texts`; un lote fallido devuelve EMPTY en sus posiciones | `for…of` secuencial: no satura FastAPI/Ollama
  async enrich(
    texts: readonly string[],
    language: string,
    token: string,
  ): Promise<{ items: SentenceLinguistics[]; failed: number }> {
    const items: SentenceLinguistics[] = [];
    let failed = 0;
    for (let i = 0; i < texts.length; i += ENRICH_BATCH) {
      const chunk = texts.slice(i, i + ENRICH_BATCH);
      try {
        const res = await this.tools.lines([...chunk], language, token);
        // [Alineación por índice]: FastAPI devuelve `index` por línea → se respeta aunque reordene u omita alguna
        const byIndex = new Map(res.lines.map((l) => [l.index, l]));
        chunk.forEach((_, j) => {
          const l = byIndex.get(j);
          items.push(
            l
              ? {
                  ipa: l.ipa ?? '',
                  ipaUs: l.ipa_us ?? null,
                  translation: l.translation?.trim() || null,
                }
              : EMPTY,
          );
        });
      } catch (err) {
        failed += chunk.length;
        this.logger.warn(
          `Lote de lectura sin IPA/traducción (${chunk.length} frases): ${err instanceof Error ? err.message : String(err)}`,
        );
        chunk.forEach(() => items.push(EMPTY));
      }
    }
    return { items, failed };
  }
}
