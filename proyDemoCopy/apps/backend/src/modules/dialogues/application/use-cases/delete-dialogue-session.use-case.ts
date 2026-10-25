import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DialogueSession } from '../../domain/entities/dialogue-session.entity';
import { DialogueTurn } from '../../domain/entities/dialogue-turn.entity';
import { OwnedDialogueSession } from './get-dialogue-session.use-case';
import { TurnRecordingUseCase } from './turn-recording.use-case';
// [UseCase DeleteDialogueSession · Sprint 9.3]: borra la conversación propia y su transcripción (privacidad: borrado físico, no lógico) | [Patrón]: Use Case (Command) + Unit of Work | [Principio]: SRP + privacidad | [Paradigma]: POO

@Injectable()
export class DeleteDialogueSessionUseCase {
  constructor(
    private readonly owned: OwnedDialogueSession,
    @InjectRepository(DialogueSession)
    private readonly sessions: Repository<DialogueSession>,
    private readonly recordings: TurnRecordingUseCase,
  ) {}

  async execute(userId: string, id: string): Promise<void> {
    await this.owned.load(userId, id);
    await this.recordings.removeAll(id); // [2026-10-20]: también las grabaciones de voz (privacidad)
    await this.sessions.manager.transaction(async (tx) => {
      await tx.delete(DialogueTurn, { sessionId: id });
      await tx.delete(DialogueSession, { id });
    });
  }
}
