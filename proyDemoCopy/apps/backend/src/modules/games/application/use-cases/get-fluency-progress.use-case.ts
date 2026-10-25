import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FluencyMetric } from '../../domain/entities/fluency-metric.entity';
import { OwnedSession } from './get-game-session.use-case';
// [UseCases GetFluencyProgress + GetSessionFluency · Sprint 8.5 · RF-105]: serie diaria de las métricas del usuario (GROUP BY día) y métricas de una partida | [Patrón]: Query (CQRS ligero) + agregación en SQL | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO + SQL declarativo

export interface FluencyPoint {
  day: string; // YYYY-MM-DD
  rounds: number;
  timeToRespondS: number;
  wordsPerMinute: number;
  pauses: number;
  longestRunS: number;
  wordsProduced: number;
  reuseRatio: number;
}

@Injectable()
export class GetFluencyProgressUseCase {
  constructor(
    @InjectRepository(FluencyMetric)
    private readonly metrics: Repository<FluencyMetric>,
  ) {}

  async execute(
    userId: string,
    from?: string,
    to?: string,
  ): Promise<FluencyPoint[]> {
    const start = from
      ? new Date(from)
      : new Date(Date.now() - 90 * 86_400_000); // Por defecto: últimos 90 días
    const end = to ? new Date(to) : new Date();
    const rows = await this.metrics
      .createQueryBuilder('m')
      .select("to_char(date_trunc('day', m.created_at), 'YYYY-MM-DD')", 'day')
      .addSelect('count(*)::int', 'rounds')
      .addSelect(
        'round(avg(m.time_to_respond_s)::numeric, 2)::float',
        'timeToRespondS',
      )
      .addSelect(
        'round(avg(m.words_per_minute)::numeric, 1)::float',
        'wordsPerMinute',
      )
      .addSelect('round(avg(m.pauses)::numeric, 1)::float', 'pauses')
      .addSelect(
        'round(avg(m.longest_run_s)::numeric, 2)::float',
        'longestRunS',
      )
      .addSelect('sum(m.words_produced)::int', 'wordsProduced')
      .addSelect('round(avg(m.reuse_ratio)::numeric, 2)::float', 'reuseRatio')
      .where('m.user_id = :userId', { userId })
      .andWhere('m.created_at BETWEEN :start AND :end', { start, end })
      .groupBy('1')
      .orderBy('1', 'ASC')
      .getRawMany<FluencyPoint>();
    return rows;
  }
}

@Injectable()
export class GetSessionFluencyUseCase {
  constructor(
    private readonly owned: OwnedSession,
    @InjectRepository(FluencyMetric)
    private readonly metrics: Repository<FluencyMetric>,
  ) {}

  async execute(userId: string, sessionId: string): Promise<FluencyMetric[]> {
    await this.owned.load(userId, sessionId);
    return this.metrics.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
    });
  }
}
