import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameRound } from '../../domain/entities/game-round.entity';
import { OwnedSession } from './get-game-session.use-case';
// [UseCases ListRounds + GetRound · Sprint 8.5]: rondas de una partida propia y detalle de una ronda | [Patrón]: Query | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO

@Injectable()
export class ListRoundsUseCase {
  constructor(
    private readonly owned: OwnedSession,
    @InjectRepository(GameRound) private readonly rounds: Repository<GameRound>,
  ) {}

  async execute(userId: string, sessionId: string): Promise<GameRound[]> {
    await this.owned.load(userId, sessionId); // 404 si la partida no es del usuario
    return this.rounds.find({ where: { sessionId }, order: { index: 'ASC' } });
  }
}

@Injectable()
export class GetRoundUseCase {
  constructor(
    @InjectRepository(GameRound) private readonly rounds: Repository<GameRound>,
  ) {}

  async execute(userId: string, id: string): Promise<GameRound> {
    const round = await this.rounds.findOneBy({ id, userId });
    if (!round) throw new NotFoundException('Ronda no encontrada');
    return round;
  }
}
