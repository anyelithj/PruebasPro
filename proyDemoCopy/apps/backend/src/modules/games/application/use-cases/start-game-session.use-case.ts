import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { VocabularyEntry } from '../../../vocabulary/domain/entities/vocabulary-entry.entity';
import { bankFor, pick } from '../../domain/game-content';
import { GAME_META, type GameType } from '../../domain/game-type';
import {
  GameSession,
  type GameSessionContent,
} from '../../domain/entities/game-session.entity';
import { RolePlayScenario } from '../../domain/entities/roleplay-scenario.entity';
// [UseCase StartGameSession · Sprint 8.5 · RF-98/RF-100/RF-101]: crea la partida con su contenido — vocabulario del banco del usuario (o tarjetas propias si aún no tiene), tarjeta de tabú, tema, escenario o frases de comprensión | [Patrón]: Use Case (Command) + Factory (contenido según la familia del juego) | [Principio]: SRP + DRY (banco de Vocabulary, contenido de game-content) | [Paradigma]: POO + async/await

export interface StartGameInput {
  gameType: GameType;
  language: string;
  level?: string | null;
  difficulty?: number;
  scenarioId?: string;
}

const SIZE_BY_DIFFICULTY = [6, 8, 12]; // Palabras por partida según dificultad

// [shuffle]: Fisher-Yates sobre una copia (no muta la entrada) | [Paradigma]: Funcional
const shuffle = <T>(items: T[]): T[] => {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

@Injectable()
export class StartGameSessionUseCase {
  constructor(
    @InjectRepository(GameSession)
    private readonly sessions: Repository<GameSession>,
    @InjectRepository(VocabularyEntry)
    private readonly entries: Repository<VocabularyEntry>,
    @InjectRepository(RolePlayScenario)
    private readonly scenarios: Repository<RolePlayScenario>,
  ) {}

  async execute(userId: string, input: StartGameInput): Promise<GameSession> {
    const difficulty = Math.min(Math.max(input.difficulty ?? 1, 1), 3);
    const bank = bankFor(input.language);
    const card = pick(bank.taboo);
    const family = GAME_META[input.gameType].family;

    // [Vocabulario]: banco propio del usuario; si tiene menos de 4 palabras, tarjetas propias del proyecto (palabra + emoji)
    const mine = await this.entries.find({
      where: { userId, language: input.language },
      take: 200,
    });
    const vocabulary =
      mine.length >= 4 && input.gameType !== 'quick_sort' // [quick_sort]: necesita categorías → siempre el banco propio (CC BY)
        ? shuffle(mine)
            .slice(0, SIZE_BY_DIFFICULTY[difficulty - 1])
            .map((e) => ({
              entryId: e.id,
              term: e.term,
              translation: e.translation,
            }))
        : shuffle(bank.taboo)
            .slice(0, SIZE_BY_DIFFICULTY[difficulty - 1])
            .map((c) => ({
              term: c.target,
              emoji: c.emoji,
              category: c.category,
            }));

    const content: GameSessionContent = { vocabulary, fallback: bank.fallback };
    let scenarioId: string | null = null;
    switch (input.gameType) {
      case 'taboo':
      case 'forbidden_word':
        Object.assign(content, {
          target: card.target,
          forbidden: card.forbidden,
        });
        break;
      case 'twenty_questions':
      case 'describe_guess':
        content.target = card.target; // Secreto: no se envía al cliente (ver toView)
        break;
      case 'chained_story':
      case 'debate':
      case 'random_topic':
      case 'speed_speaking':
        content.topic = pick(bank.topics);
        break;
      case 'role_play': {
        const scenario = input.scenarioId
          ? await this.scenarios.findOneBy({
              id: input.scenarioId,
              archivedAt: IsNull(),
            })
          : null;
        if (!scenario)
          throw new NotFoundException('Elige un escenario de role-play');
        scenarioId = scenario.id;
        Object.assign(content, {
          role: scenario.role,
          objectives: scenario.objectives,
          met: [],
          topic: scenario.title,
        });
        content.vocabulary = scenario.vocabulary.map((term) => ({ term }));
        break;
      }
      default:
        if (family === 'listening')
          content.lines = shuffle(bank.listening).slice(0, 5);
    }
    if (family === 'vocab' && content.vocabulary.length < 2)
      throw new BadRequestException(
        'No hay suficientes palabras para este juego',
      );

    return this.sessions.save(
      this.sessions.create({
        userId,
        gameType: input.gameType,
        language: input.language,
        level: input.level ?? null,
        difficulty,
        scenarioId,
        content,
        status: 'active',
      }),
    );
  }
}

// [toView]: oculta el secreto de 20 preguntas y de describe y adivina (los adivina el usuario) | [Principio]: mínimo privilegio
export function toView(session: GameSession): GameSession {
  if (
    session.status === 'active' &&
    (session.gameType === 'twenty_questions' ||
      session.gameType === 'describe_guess')
  )
    return { ...session, content: { ...session.content, target: null } };
  return session;
}
