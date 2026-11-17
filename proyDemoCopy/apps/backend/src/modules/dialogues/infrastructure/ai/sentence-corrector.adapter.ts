import { Injectable, Logger } from '@nestjs/common';
import {
  OwnLlmClientService,
  type CorrectorInput,
} from '../../../ai/own-llm-client.service';
import type {
  SentenceCorrectorPort,
  TurnFeedback,
} from '../../domain/interfaces/sentence-corrector.interface';
// [Adapter SentenceCorrector · 2026-11-13]: implementa el puerto con el cliente ÚNICO del LLM propio (FastAPI /own-llm/corrector)
// [Fail Soft]: si FastAPI no responde, el diálogo continúa sin corrección (nunca un 503 en mitad de la conversación) | [Patrón]: Adapter | [Principio]: DIP + DRY

@Injectable()
export class SentenceCorrectorAdapter implements SentenceCorrectorPort {
  private readonly logger = new Logger(SentenceCorrectorAdapter.name);

  constructor(private readonly ownLlm: OwnLlmClientService) {}

  async correct(
    input: CorrectorInput,
    token: string,
  ): Promise<TurnFeedback | null> {
    try {
      return await this.ownLlm.correctSentence(input, token);
    } catch (err) {
      this.logger.warn(
        `Corrector no disponible: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
