import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DialogueTurn } from '../../domain/entities/dialogue-turn.entity';
import { type DialogueActor, DialogueAccess } from './get-dialogue.use-case';
// [UseCases ListTurns + GetTurn · Sprint 9.3 · RF-123]: turnos con texto original, IPA, traducción y tiempos — con la visibilidad de su diálogo; los turnos de conversaciones se leen por la sesión | [Patrón]: Query | [Principio]: SRP + DRY (DialogueAccess) | [Paradigma]: POO

@Injectable()
export class ListTurnsUseCase {
  constructor(
    private readonly access: DialogueAccess,
    @InjectRepository(DialogueTurn)
    private readonly turns: Repository<DialogueTurn>,
  ) {}

  async execute(
    actor: DialogueActor,
    dialogueId: string,
  ): Promise<DialogueTurn[]> {
    await this.access.readable(actor, dialogueId);
    return this.turns.find({
      where: { dialogueId },
      order: { position: 'ASC' },
    });
  }
}

@Injectable()
export class GetTurnUseCase {
  constructor(
    private readonly access: DialogueAccess,
    @InjectRepository(DialogueTurn)
    private readonly turns: Repository<DialogueTurn>,
  ) {}

  // [load]: turno de un diálogo de la biblioteca (los de conversaciones privadas no se exponen por esta ruta)
  async load(
    actor: DialogueActor,
    id: string,
    edit = false,
  ): Promise<DialogueTurn> {
    const turn = await this.turns.findOneBy({ id });
    if (!turn?.dialogueId) throw new NotFoundException('Turno no encontrado');
    await (edit
      ? this.access.editable(actor, turn.dialogueId)
      : this.access.readable(actor, turn.dialogueId));
    return turn;
  }
}
