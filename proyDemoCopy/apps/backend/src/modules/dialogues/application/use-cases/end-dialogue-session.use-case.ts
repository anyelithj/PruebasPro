import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { TopicCrudService } from '../../../../shared/application/topic-crud.service';
import { DialogueSession } from '../../domain/entities/dialogue-session.entity';
import type { DialogueTopic } from '../../domain/entities/dialogue-topic.entity';
import {
  DIALOGUE_SESSION_COMPLETED_EVENT,
  DialogueSessionCompletedEvent,
} from '../../domain/events/dialogue-session-completed.event';
import { OwnedDialogueSession } from './get-dialogue-session.use-case';
import { DIALOGUE_TOPICS } from './start-dialogue-session.use-case';
// [UseCase EndDialogueSession · Sprint 9.3 · RF-122]: cierra la conversación y publica DialogueSessionCompleted con la cobertura del vocabulario del tema (Score revisa logros) | [Patrón]: Use Case (Command) + Domain Event (Observer) | [Principio]: SRP + OCP (Dialogues no conoce a Score) + idempotencia (cerrar dos veces no emite dos eventos) | [Paradigma]: POO + Event-Driven

@Injectable()
export class EndDialogueSessionUseCase {
  constructor(
    private readonly owned: OwnedDialogueSession,
    @Inject(DIALOGUE_TOPICS)
    private readonly topics: TopicCrudService<DialogueTopic>,
    @InjectRepository(DialogueSession)
    private readonly sessions: Repository<DialogueSession>,
    private readonly events: EventEmitter2,
  ) {}

  async execute(userId: string, id: string): Promise<DialogueSession> {
    const session = await this.owned.load(userId, id);
    if (session.status === 'ended') return session;
    Object.assign(session, { status: 'ended', endedAt: new Date() });
    const saved = await this.sessions.save(session);
    const vocab =
      (await this.topics.get(session.topicId).catch(() => null))?.vocabulary[
        session.language
      ] ?? [];
    const coverage = vocab.length
      ? Math.round((100 * session.vocabularyUsed.length) / vocab.length)
      : 0;
    this.events.emit(
      DIALOGUE_SESSION_COMPLETED_EVENT,
      new DialogueSessionCompletedEvent(
        id,
        userId,
        session.userTurns,
        Math.min(100, coverage),
      ),
    );
    return saved;
  }
}
