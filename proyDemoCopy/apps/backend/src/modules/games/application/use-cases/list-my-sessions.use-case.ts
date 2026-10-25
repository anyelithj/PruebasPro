import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameSession } from '../../domain/entities/game-session.entity';
import { toView } from './start-game-session.use-case';
// [UseCase ListMySessions · Sprint 8.5]: partidas propias (más recientes primero) con puntaje y tipo | [Patrón]: Query | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO

@Injectable()
export class ListMySessionsUseCase {
  constructor(
    @InjectRepository(GameSession)
    private readonly sessions: Repository<GameSession>,
  ) {}

  async execute(userId: string): Promise<GameSession[]> {
    const rows = await this.sessions.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return rows.map(toView);
  }
}
