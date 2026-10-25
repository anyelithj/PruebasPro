import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DialogueTurn } from '../../domain/entities/dialogue-turn.entity';
import { type DialogueActor, DialogueAccess } from './get-dialogue.use-case';
import { TurnEnricher } from './turn-enricher';

// [UseCase AddTurn + TurnEnricher · Sprint 9.3 · RF-123/RF-124]: agrega un turno con su hablante al final del diálogo y obtiene su traducción al español e IPA; TurnEnricher lo reutilizan la subida y la conversación con el avatar | [Patrón]: Use Case (Command) + Ports & Adapters (LanguageToolsPort) + degradación elegante | [Principio]: SRP + DRY + DIP | [Paradigma]: POO + async/await

@Injectable()
export class AddTurnUseCase {
  constructor(
    private readonly access: DialogueAccess,
    @InjectRepository(DialogueTurn)
    private readonly turns: Repository<DialogueTurn>,
    private readonly enricher: TurnEnricher,
  ) {}

  async execute(
    actor: DialogueActor,
    dialogueId: string,
    input: { speaker: 'A' | 'B'; text: string },
    token: string,
  ): Promise<DialogueTurn> {
    const dialogue = await this.access.editable(actor, dialogueId);
    const [ling] = await this.enricher.enrich(
      [input.text],
      dialogue.language,
      token,
    );
    const position = await this.turns.countBy({ dialogueId });
    return this.turns.save(
      this.turns.create({
        ...input,
        ...ling,
        dialogueId,
        sessionId: null,
        position,
      }),
    );
  }
}
