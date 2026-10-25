import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { TopicCrudService } from '../../../../shared/application/topic-crud.service';
import { DialogueSession } from '../../domain/entities/dialogue-session.entity';
import type { DialogueTopic } from '../../domain/entities/dialogue-topic.entity';
import { DialogueTurn } from '../../domain/entities/dialogue-turn.entity';
import {
  DIALOGUE_AGENT,
  type DialogueAgentPort,
  type DialogueContextDto,
  START_MESSAGE,
} from '../../domain/interfaces/dialogue-agent.interface';
import { TurnEnricher } from './turn-enricher';
// [UseCase StartDialogueSession · Sprints 9.3/9.12 · RF-122]: inicia una conversación con el avatar sobre un tema, en uno de los siete idiomas y a un nivel; el avatar abre con la apertura determinista del tema (FastAPI, sin LLM) | [Patrón]: Use Case (Command) + Ports & Adapters (DialogueAgentPort) | [Principio]: SRP + DIP + determinístico primero | [Paradigma]: POO + async/await

export const DIALOGUE_TOPICS = Symbol('DIALOGUE_TOPICS'); // TopicCrudService<DialogueTopic> (shared, genérico)

// [contextOf]: lo que FastAPI necesita del tema en cada turno (el vocabulario del idioma de la conversación) | Función pura
export const contextOf = (
  topic: DialogueTopic,
  language: string,
  turn: number,
): DialogueContextDto => ({
  topic: topic.slug,
  title: topic.title,
  objectives: topic.objectives,
  vocabulary: topic.vocabulary[language] ?? [],
  turn,
  opening: topic.opening,
});

@Injectable()
export class StartDialogueSessionUseCase {
  constructor(
    @Inject(DIALOGUE_TOPICS)
    private readonly topics: TopicCrudService<DialogueTopic>,
    @InjectRepository(DialogueSession)
    private readonly sessions: Repository<DialogueSession>,
    @InjectRepository(DialogueTurn)
    private readonly turns: Repository<DialogueTurn>,
    @Inject(DIALOGUE_AGENT) private readonly agent: DialogueAgentPort,
    private readonly enricher: TurnEnricher,
  ) {}

  async execute(
    userId: string,
    input: { topicId: string; language: string; level: string },
    token: string,
  ) {
    const topic = await this.topics.get(input.topicId);
    const opening = await this.agent.turn(
      {
        message: START_MESSAGE,
        language: input.language,
        level: input.level,
        dialogue: contextOf(topic, input.language, 1),
      },
      token,
    );
    const session = await this.sessions.save(
      this.sessions.create({
        ...input,
        userId,
        status: 'active',
        conversationId: opening.sessionId,
        userTurns: 0,
        vocabularyUsed: [],
        endedAt: null,
      }),
    );
    const [ling] = await this.enricher.enrich(
      [opening.reply],
      input.language,
      token,
    );
    const first = await this.turns.save(
      this.turns.create({
        sessionId: session.id,
        dialogueId: null,
        position: 0,
        speaker: 'avatar',
        text: opening.reply,
        ...ling,
        translation: ling.translation || opening.translation || null, // [2026-10-23]: la apertura semilla trae su traducción → nunca «—» en el primer turno
        correction: null,
      }),
    );
    return { session, topic, turns: [first] };
  }
}
