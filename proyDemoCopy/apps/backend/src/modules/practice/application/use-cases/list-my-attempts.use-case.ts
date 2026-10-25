import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PracticeAttempt } from '../../domain/entities/practice-attempt.entity';
// [UseCase ListMyAttempts · Sprint 8.12]: intentos propios, filtrables por actividad (los más recientes primero) | [Patrón]: Query | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO

@Injectable()
export class ListMyAttemptsUseCase {
  constructor(
    @InjectRepository(PracticeAttempt)
    private readonly attempts: Repository<PracticeAttempt>,
  ) {}

  execute(userId: string, activityId?: string): Promise<PracticeAttempt[]> {
    return this.attempts.find({
      where: { userId, ...(activityId ? { activityId } : {}) },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }
}
