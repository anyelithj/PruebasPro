import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PracticeAttempt } from '../../domain/entities/practice-attempt.entity';
// [UseCase GetAttempt · Sprint 8.12]: un intento propio con su retroalimentación (errores, corrección, respuesta correcta y consejo) | [Patrón]: Query | [Principio]: SRP + mínimo privilegio (solo el dueño: filtro por userId → 404 si es ajeno) | [Paradigma]: POO

@Injectable()
export class GetAttemptUseCase {
  constructor(
    @InjectRepository(PracticeAttempt)
    private readonly attempts: Repository<PracticeAttempt>,
  ) {}

  async execute(userId: string, id: string): Promise<PracticeAttempt> {
    const attempt = await this.attempts.findOneBy({ id, userId });
    if (!attempt) throw new NotFoundException('Intento no encontrado');
    return attempt;
  }
}
