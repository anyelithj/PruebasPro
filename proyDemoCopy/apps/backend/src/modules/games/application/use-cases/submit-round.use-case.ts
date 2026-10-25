import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameRound } from '../../domain/entities/game-round.entity';
import { GameSession } from '../../domain/entities/game-session.entity';
import type { WordStamp } from '../../domain/interfaces/game-agent.interface';
import {
  evaluateRound,
  words,
  type RoundInput,
} from '../strategies/game-evaluator.strategy';
import { OwnedSession } from './get-game-session.use-case';
import { RecordFluencyMetricUseCase } from './record-fluency-metric.use-case';
// [UseCase SubmitRound · Sprint 8.5 · RF-105]: registra la respuesta de la ronda con sus tiempos, la evalúa (Strategy) y, si fue oral, guarda las métricas de fluidez | [Patrón]: Use Case (Command) + Strategy | [Principio]: SRP + DRY (RecordFluencyMetric) | [Paradigma]: POO + async/await

export interface SubmitRoundInput extends RoundInput {
  prompt?: string;
  timeToAnswerMs?: number;
  durationMs?: number;
  words?: WordStamp[]; // Marcas de /speech/transcribe → métricas de fluidez
  promptEndS?: number;
}

@Injectable()
export class SubmitRoundUseCase {
  constructor(
    private readonly owned: OwnedSession,
    @InjectRepository(GameSession)
    private readonly sessions: Repository<GameSession>,
    @InjectRepository(GameRound) private readonly rounds: Repository<GameRound>,
    private readonly fluency: RecordFluencyMetricUseCase,
  ) {}

  async execute(
    userId: string,
    sessionId: string,
    input: SubmitRoundInput,
    token: string,
  ) {
    const session = await this.owned.load(userId, sessionId);
    if (session.status !== 'active')
      throw new ConflictException('La partida ya terminó');
    const verdict = evaluateRound(session.gameType, input, session.content);
    session.roundsCount += 1;
    if (verdict.correct) session.correctCount += 1;
    const round = await this.rounds.save(
      this.rounds.create({
        sessionId,
        userId,
        index: session.roundsCount,
        prompt: input.prompt ?? '',
        answer: input.answer,
        correct: verdict.correct,
        timeToAnswerMs: input.timeToAnswerMs ?? null,
        durationMs: input.durationMs ?? null,
        wordsProduced: words(input.answer).length,
        evaluation: { ...verdict },
      }),
    );
    await this.sessions.save(session);
    // [Ronda oral]: con marcas de tiempo se calculan y guardan las métricas (vocabulario de la sesión = objetivo)
    const metric = input.words?.length
      ? await this.fluency.execute(
          userId,
          {
            sessionId,
            roundId: round.id,
            words: input.words,
            promptEndS: input.promptEndS,
            targetVocabulary: session.content.vocabulary.map((v) => v.term),
          },
          token,
        )
      : null;
    return { round, verdict, metric };
  }
}
