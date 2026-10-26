import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  LANGUAGE_TOOLS,
  type LanguageToolsPort,
} from '../../../../shared/domain/interfaces/language-tools.interface';
import { sanitizeTranslation } from '../../domain/translation-sanitizer';
// [TurnEnricher · 2026-10-23]: IPA + traducción de varios turnos en una petición a LanguageTools | archivo propio para cortar el ciclo
// get-dialogue ↔ add-turn (SWC evalúa los metadatos de decoradores al cargar → «Cannot access 'TurnEnricher' before initialization»)
// [Patrón]: Ports & Adapters + degradación elegante | [Principio]: SRP + DRY (subida, conversación, biblioteca) + DIP | [Paradigma]: POO + async/await

export interface TurnLinguistics {
  ipa: string;
  ipaUs: string | null;
  translation: string | null;
}

@Injectable()
export class TurnEnricher {
  private readonly logger = new Logger(TurnEnricher.name);

  constructor(
    @Inject(LANGUAGE_TOOLS) private readonly tools: LanguageToolsPort,
  ) {}

  // [enrich]: una petición para varios textos; si FastAPI no responde se guardan sin IPA (se pueden corregir a mano después)
  async enrich(
    texts: string[],
    language: string,
    token: string,
  ): Promise<TurnLinguistics[]> {
    try {
      const res = await this.tools.lines(texts, language, token);
      // [2026-10-25]: `sanitizeTranslation` → nunca se guarda JSON crudo ni «yes» → «yes» (null = la UI muestra «—»)
      return res.lines.map((l, i) => ({
        ipa: l.ipa,
        ipaUs: l.ipa_us,
        translation: sanitizeTranslation(texts[i] ?? l.text, l.translation),
      }));
    } catch (err) {
      this.logger.warn(
        `Turnos sin IPA ni traducción: ${err instanceof Error ? err.message : String(err)}`,
      );
      return texts.map(() => ({ ipa: '', ipaUs: null, translation: null }));
    }
  }
}
