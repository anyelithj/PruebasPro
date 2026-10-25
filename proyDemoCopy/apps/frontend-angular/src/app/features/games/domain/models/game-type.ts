import type { IconName } from '@shared/ui/atoms/icon/icon.component';
// [Catálogo de juegos · Dominio · Sprints 8.8–8.11]: tipo de juego → ruta, emoji, familia y si necesita micrófono | [Patrón]: Lookup Table (Configuration-Driven UI) | [Principio]: SSOT (la lista de tipos es la misma que GAME_TYPES de NestJS) + OCP (juego nuevo = una entrada) | [Paradigma]: Declarativo
// [Familias]: vocab = memoria léxica · agent = contra el agente de IA · listening = comprensión · oral = hablar con micrófono

export const GAME_TYPES = [
  'flashcards',
  'memory',
  'bingo',
  'quick_sort',
  'forbidden_word',
  'taboo',
  'twenty_questions',
  'describe_guess',
  'chained_story',
  'debate',
  'random_topic',
  'role_play',
  'speed_speaking',
  'shadowing',
  'partial_dictation',
  'listen_reformulate',
  'quick_qa',
  'recovery_drills',
] as const;
export type GameType = (typeof GAME_TYPES)[number];
export type GameFamily = 'vocab' | 'agent' | 'listening' | 'oral';

export interface GameInfo {
  readonly route: string; // Segmento bajo /juegos
  readonly icon: IconName; // [2026-10-23]: icono SVG de la tarjeta (antes emoji Unicode)
  readonly family: GameFamily;
  readonly mic?: true; // Pide micrófono
}

// `Readonly<Record<GameType, …>>` (TS): exhaustivo → si NestJS agrega un tipo y aquí falta, no compila
export const GAME_INFO: Readonly<Record<GameType, GameInfo>> = Object.freeze({
  flashcards: { route: 'flashcards', icon: 'folder-open', family: 'vocab' },
  memory: { route: 'memory', icon: 'brain', family: 'vocab' },
  bingo: { route: 'bingo', icon: 'target', family: 'vocab' },
  quick_sort: { route: 'clasificar', icon: 'archive', family: 'vocab' },
  recovery_drills: { route: 'recuperacion', icon: 'zap', family: 'vocab' },
  forbidden_word: { route: 'palabra-prohibida', icon: 'ban', family: 'agent' },
  taboo: { route: 'tabu', icon: 'message-circle-off', family: 'agent' },
  twenty_questions: { route: '20-preguntas', icon: 'circle-help', family: 'agent' },
  describe_guess: { route: 'describe-adivina', icon: 'scan-search', family: 'agent' },
  chained_story: { route: 'historia', icon: 'book-open', family: 'agent' },
  debate: { route: 'debate', icon: 'scale', family: 'agent' },
  role_play: { route: 'role-play', icon: 'drama', family: 'agent' },
  random_topic: { route: 'tema', icon: 'dices', family: 'oral', mic: true },
  speed_speaking: { route: 'speed-speaking', icon: 'timer', family: 'oral', mic: true },
  shadowing: { route: 'shadowing', icon: 'audio-lines', family: 'listening', mic: true },
  partial_dictation: { route: 'dictado', icon: 'pen-line', family: 'listening' },
  listen_reformulate: { route: 'reformula', icon: 'repeat', family: 'listening' },
  quick_qa: { route: 'pregunta-rapida', icon: 'message-circle', family: 'listening' },
});

export const FAMILY_ORDER: readonly GameFamily[] = ['vocab', 'agent', 'listening', 'oral']; // Orden de las secciones del hub
