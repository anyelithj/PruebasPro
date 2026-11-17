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
  abstract deck(id: string): Observable<GameDeck>; // [2026-11-11]: un juego del docente (flashcards y role-play lo pintan en el cliente)
  abstract themes(language: string): Observable<GameThemes>; // [2026-11-11]: temas del banco → selector «Tema»
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
  topic?: string | null; // [2026-11-06]: buscador por tema del hub
  items: DeckItem[];
}
export interface DeckItem {
  term: string;
  translation?: string;
  emoji?: string;
  image?: string;
  category?: string;
  words?: string; // Prohibidas (tabú) o palabras clave (role-play), con comas
}
export const DECK_SCENARIO_PREFIX = 'mazo-'; // [2026-11-11]: /juegos/role-play/mazo-<id> = role-play creado por el docente
// [deckToScenario · 2026-11-11]: role-play del docente → misma forma que un escenario (cada ítem = objetivo con sus palabras clave) | Función pura
export const deckToScenario = (d: GameDeck) => {
  const csv = (s?: string) => (s ?? '').split(',').map((w) => w.trim()).filter(Boolean);
  return {
    id: DECK_SCENARIO_PREFIX + d.id,
    title: d.title,
    language: d.language,
    level: d.level ?? '',
    emoji: d.items.find((i) => i.emoji)?.emoji ?? '🎭',
    role: d.title,
    opening: '',
    objectives: d.items.map((i, k) => ({ id: `g${k + 1}`, text: i.term, keywords: csv(i.words).map((w) => w.toLowerCase()) })),
    vocabulary: [...new Set(d.items.flatMap((i) => csv(i.words)))],
  };
};
// [GameThemes · 2026-11-11]: GET /games/themes — categorías de tarjetas y temas de conversación del banco del idioma
export interface GameThemes {
  categories: string[];
  topics: string[];
}
