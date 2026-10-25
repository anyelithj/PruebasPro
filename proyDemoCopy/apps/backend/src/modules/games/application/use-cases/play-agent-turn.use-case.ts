import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GAME_META } from '../../domain/game-type';
import { GameRound } from '../../domain/entities/game-round.entity';
import { GameSession } from '../../domain/entities/game-session.entity';
import {
  GAME_AGENT,
  type GameAgentPort,
} from '../../domain/interfaces/game-agent.interface';
import { words } from '../strategies/game-evaluator.strategy';
import { OwnedSession } from './get-game-session.use-case';
// [UseCase PlayAgentTurn · Sprints 8.5/8.7 · RF-100/RF-101]: jugada del usuario → turno del agente (FastAPI, persona «game») con el estado de la partida; guarda la ronda y aplica los eventos del motor (acierto, falta, objetivos) | [Patrón]: Use Case (Command) + Port (GameAgentPort) | [Principio]: SRP + la partida vive en NestJS (FastAPI sin estado) | [Paradigma]: POO + async/await

const MAX_TURNS = 20;

@Injectable()
export class PlayAgentTurnUseCase {
  constructor(
    private readonly owned: OwnedSession,
    @InjectRepository(GameSession)
    private readonly sessions: Repository<GameSession>,
    @InjectRepository(GameRound) private readonly rounds: Repository<GameRound>,
    @Inject(GAME_AGENT) private readonly agent: GameAgentPort,
  ) {}

  async execute(
    userId: string,
    sessionId: string,
    message: string,
    token: string,
    timeToAnswerMs?: number,
  ) {
    const session = await this.owned.load(userId, sessionId);
    const engine = GAME_META[session.gameType].agentGame;
    if (!engine)
      throw new BadRequestException('Este juego no se juega contra el agente');
    if (session.status !== 'active')
      throw new ConflictException('La partida ya terminó');
    const c = session.content;
    const turn = await this.agent.turn(
      {
        message,
        conversationId: c.conversationId,
        language: session.language,
        level: session.level,
        game: {
          game: engine,
          turn: session.roundsCount + 1,
          max_turns: MAX_TURNS,
          target: c.target ?? null,
          forbidden: c.forbidden ?? [],
          topic: c.topic ?? null,
          vocabulary: c.vocabulary.map((v) => v.term).slice(0, 40),
          role: c.role ?? null,
          objectives: c.objectives ?? [],
          met: c.met ?? [],
        },
      },
      token,
    );
    const state = turn.state;
    // [Acierto]: tabú → adivinó el agente · 20 preguntas / describe → adivinó el usuario · falta → incorrecta
    const correct =
      state.violation === true ? false : state.solved === true ? true : null;
    session.roundsCount += 1;
    if (correct) session.correctCount += 1;
    session.content = {
      ...c,
      conversationId: turn.sessionId,
      met: Array.isArray(state.met) ? (state.met as string[]) : c.met,
    };
    await this.sessions.save(session);
    const round = await this.rounds.save(
      this.rounds.create({
        sessionId,
        userId,
        index: session.roundsCount,
        prompt: '',
        answer: message,
        correct,
        timeToAnswerMs: timeToAnswerMs ?? null,
        wordsProduced: words(message).length,
        evaluation: {
          reply: turn.reply,
          answeredBy: turn.answeredBy,
          ...state,
        },
      }),
    );
    const finished =
      state.finished === true ||
      state.solved === true ||
      session.roundsCount >= MAX_TURNS;
    return { reply: turn.reply, state, round, finished };
  }
}
