import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FluencyMetric } from '../../domain/entities/fluency-metric.entity';
import {
  SPEECH,
  type SpeechPort,
  type WordStamp,
} from '../../domain/interfaces/game-agent.interface';
// [UseCase RecordFluencyMetric · Sprint 8.5 · RF-102/RF-105]: calcula (FastAPI Speech, determinista) y guarda las métricas de una ronda oral | [Patrón]: Use Case (Command) + Port (SpeechPort) | [Principio]: SRP + DIP | [Paradigma]: POO + async/await

export interface FluencyInput {
  sessionId: string;
  roundId?: string | null;
  words: WordStamp[];
  promptEndS?: number;
  targetVocabulary?: string[];
}

@Injectable()
export class RecordFluencyMetricUseCase {
  constructor(
    @InjectRepository(FluencyMetric)
    private readonly metrics: Repository<FluencyMetric>,
    @Inject(SPEECH) private readonly speech: SpeechPort,
  ) {}

  async execute(
    userId: string,
    input: FluencyInput,
    token: string,
  ): Promise<FluencyMetric> {
    const m = await this.speech.fluency(
      {
        words: input.words,
        prompt_end_s: input.promptEndS ?? 0,
        target_vocabulary: input.targetVocabulary ?? [],
      },
      token,
    );
    return this.metrics.save(
      this.metrics.create({
        userId,
        sessionId: input.sessionId,
        roundId: input.roundId ?? null,
        timeToRespondS: m.time_to_respond_s,
        speakingTimeS: m.speaking_time_s,
        pauses: m.pauses,
        longestRunS: m.longest_run_s,
        wordsProduced: m.words_produced,
        wordsPerMinute: m.words_per_minute,
        reuseRatio: m.reuse_ratio,
      }),
    );
  }
}
