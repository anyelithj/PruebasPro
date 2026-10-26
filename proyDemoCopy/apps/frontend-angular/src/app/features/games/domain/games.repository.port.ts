import type { Observable } from 'rxjs';
import type {
  AgentTurn,
  Catalog,
  DueCard,
  FluencyMetric,
  GameSession,
  RoundInput,
  Scenario,
  SessionDetail,
  StartInput,
  SubmitResult,
  Transcription,
  WordStamp,
} from './models/games';
// [Puerto GamesRepository · Dominio · Sprints 8.8–8.11]: partidas y rondas, turno del agente, mazo SM-2, escenarios, fluidez y voz | [Patrón]: Port (Hexagonal) + Repository | [Principio]: DIP + ISP
// `abstract class` (TS): contrato + token de inyección a la vez

export abstract class GamesRepository {
  abstract catalog(): Observable<Catalog>;
  abstract decks(): Observable<GameDeck[]>; // [2026-10-26]: juegos con material propio publicados en Gestión
  abstract start(input: StartInput): Observable<GameSession>;
  abstract mine(): Observable<GameSession[]>;
  abstract session(id: string): Observable<SessionDetail>;
  abstract submitRound(sessionId: string, input: RoundInput): Observable<SubmitResult>;
  abstract finish(sessionId: string): Observable<GameSession>;
  abstract cancel(sessionId: string): Observable<void>;
  abstract agentTurn(
    sessionId: string,
    message: string,
    timeToAnswerMs?: number,
  ): Observable<AgentTurn>;
  abstract dueCards(limit?: number): Observable<DueCard[]>;
  abstract addCard(entryId: string): Observable<unknown>;
  abstract myEntryIds(): Observable<string[]>; // Ids del banco de vocabulario propio (llenar el mazo)
  abstract review(cardId: string, quality: number): Observable<unknown>;
  abstract scenarios(language?: string, level?: string): Observable<Scenario[]>;
  abstract scenario(id: string): Observable<Scenario>;
  abstract fluency(): Observable<FluencyMetric[]>;
  abstract clearFluency(): Observable<void>;
  abstract transcribe(audio: Blob, language: string): Observable<Transcription>;
  abstract analyze(
    words: WordStamp[],
    targetVocabulary: string[],
  ): Observable<Record<string, unknown>>;
}

// [GameDeck · 2026-10-26]: lo mínimo que el hub necesita de GET /games/decks (se juega con ?mazo=)
export interface GameDeck {
  id: string;
  title: string;
  gameType: string;
  language: string;
  level: string | null;
  items: unknown[];
}
