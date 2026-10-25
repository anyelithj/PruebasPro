import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DialogueTurn } from '../../domain/entities/dialogue-turn.entity';
import type { DialogueActor } from './get-dialogue.use-case';
import { GetTurnUseCase } from './list-turns.use-case';
// [UseCase RemoveTurn · Sprint 9.3]: quita un turno (un diálogo conserva al menos dos) | [Patrón]: Use Case (Command) | [Principio]: SRP + Fail Fast | [Paradigma]: POO

@Injectable()
export class RemoveTurnUseCase {
  constructor(
    private readonly get: GetTurnUseCase,
    @InjectRepository(DialogueTurn)
    private readonly turns: Repository<DialogueTurn>,
  ) {}

  async execute(actor: DialogueActor, id: string): Promise<void> {
    const turn = await this.get.load(actor, id, true);
    if ((await this.turns.countBy({ dialogueId: turn.dialogueId! })) <= 2)
      throw new BadRequestException('Un diálogo necesita al menos dos turnos');
    await this.turns.delete({ id });
  }
}
