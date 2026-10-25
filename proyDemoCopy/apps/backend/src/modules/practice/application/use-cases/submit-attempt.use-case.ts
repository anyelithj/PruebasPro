import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PracticeAttempt } from '../../domain/entities/practice-attempt.entity';
import { PracticeItem } from '../../domain/entities/practice-item.entity';
import {
  PRACTICE_ATTEMPTED_EVENT,
  PracticeAttemptedEvent,
} from '../../domain/events/practice-attempted.event';
import {
  PRACTICE_EVALUATOR,
  type PracticeEvaluatorPort,
} from '../../domain/interfaces/practice-evaluator.interface';
import { ActivityAccess } from './get-activity.use-case';
import type { PracticeActor } from './list-activities.use-case';
// [UseCase SubmitAttempt · Sprint 8.12 · RF-112/RF-113]: evalúa la respuesta al instante (FastAPI Grading) → errores con tipo y posición, corrección, respuesta correcta y consejo; guarda el intento y emite el evento de puntos | [Patrón]: Use Case (Command) + Port (PracticeEvaluatorPort) + Domain Event | [Principio]: SRP + DIP + OCP | [Paradigma]: POO + Event-Driven

@Injectable()
export class SubmitAttemptUseCase {
  constructor(
    private readonly access: ActivityAccess,
    @InjectRepository(PracticeItem)
    private readonly items: Repository<PracticeItem>,
    @InjectRepository(PracticeAttempt)
    private readonly attempts: Repository<PracticeAttempt>,
    @Inject(PRACTICE_EVALUATOR)
    private readonly evaluator: PracticeEvaluatorPort,
    private readonly events: EventEmitter2,
  ) {}

  async execute(
    actor: PracticeActor,
    itemId: string,
    answer: string[],
    token: string,
  ): Promise<PracticeAttempt> {
    const item = await this.items.findOneBy({ id: itemId });
    if (!item) throw new NotFoundException('Ítem no encontrado');
    const activity = await this.access.readable(actor, item.activityId); // Solo actividades publicadas (o propias)
    const feedback = await this.evaluator.evaluate(
      {
        item_type: item.itemType,
        skill: item.skill,
        language: activity.language,
        prompt: item.prompt,
        answer,
        accepted: item.accepted,
        corrections: item.corrections,
        explanation: item.explanation,
        tip: item.tip,
      },
      token,
    );
    const attempt = await this.attempts.save(
      this.attempts.create({
        userId: actor.id,
        activityId: activity.id,
        itemId,
        answer,
        correct: feedback.correct,
        score: feedback.score,
        feedback: feedback as unknown as Record<string, unknown>,
      }),
    );
    this.events.emit(
      PRACTICE_ATTEMPTED_EVENT,
      new PracticeAttemptedEvent(
        actor.id,
        attempt.id,
        feedback.correct,
        feedback.score,
      ),
    );
    return attempt;
  }
}
