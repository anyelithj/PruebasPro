import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dialogue } from '../../domain/entities/dialogue.entity';
import { DialogueTurn } from '../../domain/entities/dialogue-turn.entity';
import {
  LEVEL_CLASSIFIER,
  type LevelClassifierPort,
} from '../../domain/interfaces/level-classifier.interface';
// [UseCase ClassifyDialogueLevel · Sprint 9.3 · RF-126]: estima el nivel CEFR del diálogo con FastAPI y lo guarda como «estimado» con sus indicadores; si FastAPI no responde el diálogo queda sin nivel y el docente lo fija | [Patrón]: Use Case (Command) + Ports & Adapters (LevelClassifierPort) | [Principio]: verificación humana (nunca se publica sin confirmar) + degradación elegante | [Paradigma]: POO + async/await

@Injectable()
export class ClassifyDialogueLevelUseCase {
  private readonly logger = new Logger(ClassifyDialogueLevelUseCase.name);

  constructor(
    @InjectRepository(Dialogue)
    private readonly dialogues: Repository<Dialogue>,
    @InjectRepository(DialogueTurn)
    private readonly turns: Repository<DialogueTurn>,
    @Inject(LEVEL_CLASSIFIER) private readonly classifier: LevelClassifierPort,
  ) {}

  async execute(dialogue: Dialogue, token: string): Promise<Dialogue> {
    const texts = (
      await this.turns.find({
        where: { dialogueId: dialogue.id },
        order: { position: 'ASC' },
      })
    ).map((t) => t.text);
    try {
      const estimate = await this.classifier.classify(
        { language: dialogue.language, turns: texts },
        token,
      );
      Object.assign(dialogue, {
        level: estimate.level,
        levelEstimate: estimate,
        levelStatus: 'estimated',
      });
    } catch (err) {
      this.logger.warn(
        `Diálogo ${dialogue.id} sin nivel estimado: ${err instanceof Error ? err.message : String(err)}`,
      );
      Object.assign(dialogue, {
        levelEstimate: null,
        levelStatus: 'estimated',
      });
    }
    return this.dialogues.save(dialogue);
  }
}
