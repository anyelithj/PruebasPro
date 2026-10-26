import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { TopicCrudService } from '../../../../shared/application/topic-crud.service';
import { DialogueSession } from '../../domain/entities/dialogue-session.entity';
import type { DialogueTopic } from '../../domain/entities/dialogue-topic.entity';
import { DialogueTurn } from '../../domain/entities/dialogue-turn.entity';
import {
  DIALOGUE_AGENT,
  type DialogueAgentPort,
} from '../../domain/interfaces/dialogue-agent.interface';
import { sanitizeTranslation } from '../../domain/translation-sanitizer';
import { TurnEnricher } from './turn-enricher';
import { EndDialogueSessionUseCase } from './end-dialogue-session.use-case';
import { OwnedDialogueSession } from './get-dialogue-session.use-case';
import { DIALOGUE_TOPICS, contextOf } from './start-dialogue-session.use-case';
// [UseCase SubmitUserTurn · Sprints 9.3/9.12 · RF-122/RF-124]: guarda lo que dijo el usuario (texto transcrito; el audio no se guarda), pide la respuesta del avatar y guarda ambos turnos con IPA y traducción (una sola llamada a LanguageTools) | [Patrón]: Use Case (Command) + Ports & Adapters | [Principio]: SRP + privacidad + DRY (TurnEnricher, contextOf) | [Paradigma]: POO + async/await

const MAX_USER_TURNS = 40; // Una conversación larga se cierra y se empieza otra (el historial del LLM tiene límite)

@Injectable()
export class SubmitUserTurnUseCase {
  constructor(
    private readonly owned: OwnedDialogueSession,
    @Inject(DIALOGUE_TOPICS)
    private readonly topics: TopicCrudService<DialogueTopic>,
    @InjectRepository(DialogueSession)
    private readonly sessions: Repository<DialogueSession>,
    @InjectRepository(DialogueTurn)
    private readonly turns: Repository<DialogueTurn>,
    @Inject(DIALOGUE_AGENT) private readonly agent: DialogueAgentPort,
    private readonly enricher: TurnEnricher,
    private readonly end: EndDialogueSessionUseCase, // [2026-10-23]: reutiliza el cierre (evento de logros incluido) cuando el usuario se despide | [Principio]: DRY
  ) {}

  async execute(
    userId: string,
    sessionId: string,
    text: string,
    token: string,
  ) {
    const session = await this.owned.load(userId, sessionId);
    if (session.status !== 'active')
      throw new BadRequestException('La conversación ya terminó');
    if (session.userTurns >= MAX_USER_TURNS)
      throw new BadRequestException(
        'Conversación muy larga: termínala y empieza otra',
      );
    const topic = await this.topics.get(session.topicId);
    const reply = await this.agent.turn(
      {
        message: text,
        conversationId: session.conversationId,
        language: session.language,
        level: session.level,
        dialogue: contextOf(topic, session.language, session.userTurns + 2),
      },
      token,
    );
    const [userLing, avatarLing] = await this.enricher.enrich(
      [text, reply.reply],
      session.language,
      token,
    );
    const position = await this.turns.countBy({ sessionId });
    const [userTurn, avatarTurn] = await this.turns.save([
      this.turns.create({
        sessionId,
        dialogueId: null,
        position,
        speaker: 'user',
        text,
        ...userLing,
        // [2026-10-23]: respaldo con la traducción del avatar · [2026-10-25]: también saneada (antes llegaba JSON crudo)
        translation: userLing.translation || sanitizeTranslation(text, reply.learnerTranslation),
        correction: reply.correction,
      }),
      this.turns.create({
        sessionId,
        dialogueId: null,
        position: position + 1,
        speaker: 'avatar',
        text: reply.reply,
        ...avatarLing,
        translation: avatarLing.translation || sanitizeTranslation(reply.reply, reply.translation), // [2026-10-20 / 2026-10-25]: respaldo saneado
        correction: null,
      }),
    ]);
    Object.assign(session, {
      userTurns: session.userTurns + 1,
      conversationId: reply.sessionId,
      vocabularyUsed: [
        ...new Set([...session.vocabularyUsed, ...reply.vocabularyUsed]),
      ],
    });
    await this.sessions.save(session);
    if (reply.finished) await this.end.execute(userId, sessionId); // Despedida → sesión terminada (no más preguntas del avatar)
    return {
      userTurn,
      avatarTurn,
      correction: reply.correction,
      vocabularyUsed: session.vocabularyUsed,
      ended: !!reply.finished, // `!!` (JS): booleano estricto para el cliente
    };
  }
}
