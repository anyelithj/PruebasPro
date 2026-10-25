import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  LANGUAGE_TOOLS,
  type LanguageToolsPort,
} from '../../../../shared/domain/interfaces/language-tools.interface';
import { GrammarExample } from '../../domain/entities/grammar-example.entity';
// [UseCase EnrichExample · Sprint 10.9 · RF-134]: obtiene el IPA (UK y US en inglés) y la traducción al español de los ejemplos sin revisar con FastAPI /language-tools/lines (el mismo de canciones y diálogos) | [Patrón]: Use Case (Command) + Ports & Adapters (LanguageToolsPort compartido) + degradación elegante | [Principio]: DIP + DRY + verificación humana | [Paradigma]: POO + async/await

@Injectable()
export class EnrichExampleUseCase {
  private readonly logger = new Logger(EnrichExampleUseCase.name);

  constructor(
    @InjectRepository(GrammarExample)
    private readonly examples: Repository<GrammarExample>,
    @Inject(LANGUAGE_TOOLS) private readonly tools: LanguageToolsPort,
  ) {}

  // [execute]: un lote por ficha (todas las frases van en una sola petición); si FastAPI no responde quedan sin IPA y se reintenta
  async execute(
    ids: string[],
    language: string,
    token: string,
  ): Promise<{ updated: number }> {
    const pending = ids.length
      ? await this.examples.find({ where: { id: In(ids), reviewed: false } })
      : [];
    if (!pending.length) return { updated: 0 };
    try {
      const res = await this.tools.lines(
        pending.map((e) => e.text),
        language,
        token,
      );
      for (const line of res.lines) {
        const e = pending[line.index];
        if (!e) continue;
        e.ipa = line.ipa;
        e.ipaUs = line.ipa_us;
        e.translation = line.translation;
      }
      await this.examples.save(pending);
      return { updated: pending.length };
    } catch (err) {
      this.logger.warn(
        `Ejemplos sin IPA ni traducción: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { updated: 0 };
    }
  }
}
