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
  type DialogueHistoryTurn,
} from '../../domain/interfaces/dialogue-agent.interface';
import { sanitizeTranslation } from '../../domain/translation-sanitizer';
import {
  SENTENCE_CORRECTOR,
  type SentenceCorrectorPort,
} from '../../domain/interfaces/sentence-corrector.interface';
import { TurnEnricher } from './turn-enricher';
import { EndDialogueSessionUseCase } from './end-dialogue-session.use-case';
import { OwnedDialogueSession } from './get-dialogue-session.use-case';
import { DIALOGUE_TOPICS, contextOf } from './start-dialogue-session.use-case';
// [UseCase SubmitUserTurn · Sprints 9.3/9.12 · RF-122/RF-124]: guarda lo que dijo el usuario (texto transcrito; el audio no se guarda), pide la respuesta del avatar y guarda ambos turnos con IPA y traducción (una sola llamada a LanguageTools) | [Patrón]: Use Case (Command) + Ports & Adapters | [Principio]: SRP + privacidad + DRY (TurnEnricher, contextOf) | [Paradigma]: POO + async/await

// [toHistory]: turno guardado → turno de historial; del estudiante se envía su frase CORREGIDA (el avatar no «aprende» el error)
// `?.` (ES2020): turnos antiguos sin `feedback` usan el texto original | [Patrón]: Mapper | [Paradigma]: funcional (pura)
const toHistory = (t: DialogueTurn): DialogueHistoryTurn => ({
  role: t.speaker === 'avatar' ? 'assistant' : 'user',
  content:
    (t.speaker === 'user' && t.feedback?.correccion.frase_corregida) || t.text,
});

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
    @Inject(SENTENCE_CORRECTOR)
    private readonly corrector: SentenceCorrectorPort, // [2026-11-13 · Anexo A]: corrección pedagógica única
  ) {}

  async execute(
    userId: string,
    sessionId: string,
    text: string,
    token: string,
    origin: 'voz' | 'escrito' = 'escrito', // [Anexo A «origen»]: `= …` (ES2015): parámetro por defecto
  ) {
    const session = await this.owned.load(userId, sessionId);
    if (session.status !== 'active')
      throw new BadRequestException('La conversación ya terminó');
    if (session.userTurns >= MAX_USER_TURNS)
      throw new BadRequestException(
        'Conversación muy larga: termínala y empieza otra',
      );
    const topic = await this.topics.get(session.topicId);
    // [2026-11-13 · Caso A]: UNA corrección con la pregunta previa del avatar → feedback, puntuación y frase para el avatar salen del mismo JSON
    // [Tarea 1 · RNF-06]: UNA consulta trae el historial guardado (dialogue_turns); de ahí salen la pregunta previa y el contexto del avatar
    // `find` + `order` (TypeORM): turnos de la sesión en orden; máx. 2 × MAX_USER_TURNS filas → acotado
    const previous = await this.turns.find({
      where: { sessionId },
      order: { position: 'ASC' },
    });
    // `findLast` (ES2023): último turno del avatar = la pregunta que el estudiante está respondiendo
    const asked = previous.findLast((t) => t.speaker === 'avatar');
    const feedback = await this.corrector.correct(
      {
        pregunta_previa: asked?.text ?? '',
        texto: text,
        idioma: session.language,
        nivel: session.level,
        tema: topic.title,
        origen: origin,
      },
      token,
    );
    // El avatar responde a la frase CORREGIDA (no a la transcripción cruda: «Nice to meet you from Columbia!») salvo si no respondió a la pregunta
    const understood =
      feedback && feedback.correccion.veredicto !== 'no_responde'
        ? feedback.correccion.frase_corregida
        : text;
    const reply = await this.agent.turn(
      {
        message: understood,
        conversationId: session.conversationId,
        language: session.language,
        level: session.level,
        dialogue: contextOf(topic, session.language, session.userTurns + 2),
        history: previous.map(toHistory), // FastAPI reconstruye la conversación (no depende de su memoria)
      },
      token,
    );
    // [2026-11-13]: traducción con el contexto de la conversación (pregunta del avatar + lo que el estudiante quiso decir)
    const [userLing, avatarLing] = await this.enricher.enrich(
      [text, reply.reply],
      session.language,
      token,
      [asked?.text, understood].filter(Boolean).join('\n'),
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
        // [Anexo A regla 7]: la traducción del turno del estudiante es la de su frase CORREGIDA (no «Mi sobrina es Laura»)
        translation:
          feedback?.correccion.traduccion ||
          userLing.translation ||
          sanitizeTranslation(text, reply.learnerTranslation),
        correction: null, // [2026-11-13]: la corrección vive en `feedback` (antes la escribía el LLM del avatar → un segundo criterio)
        feedback,
      }),
      this.turns.create({
        sessionId,
        dialogueId: null,
        position: position + 1,
        speaker: 'avatar',
        text: reply.reply,
        ...avatarLing,
        translation:
          avatarLing.translation ||
          sanitizeTranslation(reply.reply, reply.translation), // [2026-10-20 / 2026-10-25]: respaldo saneado
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
      feedback,
      vocabularyUsed: session.vocabularyUsed,
      ended: !!reply.finished, // `!!` (JS): booleano estricto para el cliente
    };
  }
}
