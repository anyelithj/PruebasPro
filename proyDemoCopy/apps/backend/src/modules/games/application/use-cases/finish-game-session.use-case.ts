import { ConflictException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  GAME_COMPLETED_EVENT,
  GameCompletedEvent,
} from '../../domain/events/game-completed.event';
import { GameRound } from '../../domain/entities/game-round.entity';
import { GameSession } from '../../domain/entities/game-session.entity';
import { OwnedSession } from './get-game-session.use-case';
// [UseCase FinishGameSession · Sprint 8.5 · RF-105]: cierra la partida, calcula el puntaje (aciertos + palabras producidas, no solo acertar) y emite GameCompleted | [Patrón]: Use Case (Command) + Domain Event | [Principio]: SRP + OCP (Score se suscribe) | [Paradigma]: POO + Event-Driven

// [scoreOf]: 10 por acierto + 1 por cada 5 palabras producidas (premia la fluidez) | Función pura
export const scoreOf = (
  rounds: Pick<GameRound, 'correct' | 'wordsProduced'>[],
): number =>
  rounds.reduce(
    (sum, r) => sum + (r.correct ? 10 : 0) + Math.floor(r.wordsProduced / 5),
    0,
  );

@Injectable()
export class FinishGameSessionUseCase {
  constructor(
    private readonly owned: OwnedSession,
    @InjectRepository(GameSession)
    private readonly sessions: Repository<GameSession>,
    @InjectRepository(GameRound) private readonly rounds: Repository<GameRound>,
    private readonly events: EventEmitter2,
  ) {}

  async execute(userId: string, id: string): Promise<GameSession> {
    const session = await this.owned.load(userId, id);
    if (session.status === 'finished') return session; // [Idempotente]
    if (session.status === 'cancelled')
      throw new ConflictException('La partida fue abandonada');
    const rounds = await this.rounds.findBy({ sessionId: id });
    const graded = rounds.filter((r) => r.correct !== null);
    session.score = scoreOf(rounds);
    session.correctCount = graded.filter((r) => r.correct).length;
    session.roundsCount = rounds.length;
    session.status = 'finished';
    session.finishedAt = new Date();
    const saved = await this.sessions.save(session);
    const accuracy = graded.length
      ? Math.round((session.correctCount / graded.length) * 100)
      : 100;
    this.events.emit(
      GAME_COMPLETED_EVENT,
      new GameCompletedEvent(
        id,
        userId,
        session.gameType,
        session.score,
        accuracy,
      ),
    );
    return saved;
  }
}
