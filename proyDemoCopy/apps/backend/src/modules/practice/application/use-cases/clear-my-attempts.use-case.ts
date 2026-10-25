import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PracticeAttempt } from '../../domain/entities/practice-attempt.entity';
// [UseCase ClearMyAttempts · Sprint 8.12]: borra el historial propio de intentos (privacidad) | [Patrón]: Use Case (Command) | [Principio]: SRP + derecho de supresión | [Paradigma]: POO

@Injectable()
export class ClearMyAttemptsUseCase {
  constructor(
    @InjectRepository(PracticeAttempt)
    private readonly attempts: Repository<PracticeAttempt>,
  ) {}

  async execute(userId: string): Promise<{ deleted: number }> {
    const { affected } = await this.attempts.delete({ userId });
    return { deleted: affected ?? 0 };
  }
}
