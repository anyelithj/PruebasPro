import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameSession } from '../../domain/entities/game-session.entity';
import { OwnedSession } from './get-game-session.use-case';
// [UseCase CancelGameSession · Sprint 8.5]: abandona una partida en curso (no puntúa) | [Patrón]: Use Case (Command) + State (active → cancelled) | [Principio]: SRP | [Paradigma]: POO

@Injectable()
export class CancelGameSessionUseCase {
  constructor(
    private readonly owned: OwnedSession,
    @InjectRepository(GameSession)
    private readonly sessions: Repository<GameSession>,
  ) {}

  async execute(userId: string, id: string): Promise<void> {
    const session = await this.owned.load(userId, id);
    if (session.status !== 'active') return; // Terminada o ya abandonada: nada que hacer
    session.status = 'cancelled';
    session.finishedAt = new Date();
    await this.sessions.save(session);
  }
}
