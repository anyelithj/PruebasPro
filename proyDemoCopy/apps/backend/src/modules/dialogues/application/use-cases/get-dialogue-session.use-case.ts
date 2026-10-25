import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DialogueSession } from '../../domain/entities/dialogue-session.entity';
import { DialogueTurn } from '../../domain/entities/dialogue-turn.entity';
// [UseCases OwnedDialogueSession + GetDialogueSession · Sprint 9.3 · RF-124]: transcripción completa de una conversación propia con IPA y traducción lado a lado (la ajena «no existe») | [Patrón]: Query + Guard reutilizable | [Principio]: SRP + privacidad + DRY | [Paradigma]: POO

@Injectable()
export class OwnedDialogueSession {
  constructor(
    @InjectRepository(DialogueSession)
    private readonly sessions: Repository<DialogueSession>,
  ) {}

  async load(userId: string, id: string): Promise<DialogueSession> {
    const s = await this.sessions.findOneBy({ id, userId });
    if (!s) throw new NotFoundException('Conversación no encontrada');
    return s;
  }
}

@Injectable()
export class GetDialogueSessionUseCase {
  constructor(
    private readonly owned: OwnedDialogueSession,
    @InjectRepository(DialogueTurn)
    private readonly turns: Repository<DialogueTurn>,
  ) {}

  async execute(userId: string, id: string) {
    const session = await this.owned.load(userId, id);
    return {
      ...session,
      turns: await this.turns.find({
        where: { sessionId: id },
        order: { position: 'ASC' },
      }),
    };
  }
}
