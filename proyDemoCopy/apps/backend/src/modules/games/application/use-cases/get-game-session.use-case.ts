import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FluencyMetric } from '../../domain/entities/fluency-metric.entity';
import { GameRound } from '../../domain/entities/game-round.entity';
import { GameSession } from '../../domain/entities/game-session.entity';
import { toView } from './start-game-session.use-case';
// [UseCases OwnedSession + GetGameSession · Sprint 8.5]: carga una partida del usuario (404 si es ajena) y el resumen de resultados — rondas y métricas de fluidez | [Patrón]: Query + Guard reutilizable (OwnedSession) | [Principio]: SRP + DRY + mínimo privilegio | [Paradigma]: POO + async/await

@Injectable()
export class OwnedSession {
  constructor(
    @InjectRepository(GameSession)
    private readonly sessions: Repository<GameSession>,
  ) {}

  async load(userId: string, id: string): Promise<GameSession> {
    const session = await this.sessions.findOneBy({ id, userId });
    if (!session) throw new NotFoundException('Partida no encontrada');
    return session;
  }
}

@Injectable()
export class GetGameSessionUseCase {
  constructor(
    private readonly owned: OwnedSession,
    @InjectRepository(GameRound) private readonly rounds: Repository<GameRound>,
    @InjectRepository(FluencyMetric)
    private readonly metrics: Repository<FluencyMetric>,
  ) {}

  async execute(userId: string, id: string) {
    const session = await this.owned.load(userId, id);
    const [rounds, metrics] = await Promise.all([
      this.rounds.find({ where: { sessionId: id }, order: { index: 'ASC' } }),
      this.metrics.find({
        where: { sessionId: id },
        order: { createdAt: 'ASC' },
      }),
    ]);
    return { session: toView(session), rounds, metrics };
  }
}
