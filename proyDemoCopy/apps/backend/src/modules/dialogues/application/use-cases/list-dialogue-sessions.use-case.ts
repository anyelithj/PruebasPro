import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DialogueSession } from '../../domain/entities/dialogue-session.entity';
// [UseCase ListDialogueSessions · Sprint 9.3]: conversaciones propias con el avatar, la más reciente primero | [Patrón]: Query | [Principio]: SRP + privacidad (solo las del usuario del JWT) | [Paradigma]: POO

@Injectable()
export class ListDialogueSessionsUseCase {
  constructor(
    @InjectRepository(DialogueSession)
    private readonly sessions: Repository<DialogueSession>,
  ) {}

  execute(userId: string): Promise<DialogueSession[]> {
    return this.sessions.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }
}
