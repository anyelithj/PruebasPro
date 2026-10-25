import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DialogueTurn } from '../../domain/entities/dialogue-turn.entity';
import type { DialogueActor } from './get-dialogue.use-case';
import { GetTurnUseCase } from './list-turns.use-case';
// [UseCase UpdateTurn · Sprint 9.3 · RF-123/RF-124]: corrige texto, IPA, traducción o tiempos de un turno; la corrección manual prevalece (reviewed) | [Patrón]: Use Case (Command) | [Principio]: SRP + verificación humana + Fail Fast (tiempos coherentes) | [Paradigma]: POO

@Injectable()
export class UpdateTurnUseCase {
  constructor(
    private readonly get: GetTurnUseCase,
    @InjectRepository(DialogueTurn)
    private readonly turns: Repository<DialogueTurn>,
  ) {}

  async execute(
    actor: DialogueActor,
    id: string,
    patch: Partial<
      Pick<
        DialogueTurn,
        'speaker' | 'text' | 'ipa' | 'ipaUs' | 'translation' | 'startS' | 'endS'
      >
    >,
  ): Promise<DialogueTurn> {
    const turn = await this.get.load(actor, id, true);
    Object.assign(
      turn,
      Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined),
      ),
      { reviewed: true },
    );
    if (turn.startS !== null && turn.endS !== null && turn.endS < turn.startS)
      throw new BadRequestException('El turno termina antes de empezar');
    return this.turns.save(turn);
  }
}
