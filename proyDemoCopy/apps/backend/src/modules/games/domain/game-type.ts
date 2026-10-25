// [Enum GameType · Sprint 8.5 · RF-98 a RF-104]: catálogo de tipos de juego agrupados por lo que entrenan | [Patrón]: Lookup Table + SSOT | [Principio]: OCP (juego nuevo = una entrada) | [Paradigma]: Declarativo
// [Familias]: «vocab» = cerrados, los evalúa NestJS · «agent» = turnos con el agente de FastAPI (persona game) · «listening» y «oral» = voz con faster-whisper

export const GAME_TYPES = [
  // Memoria léxica y vocabulario activo (8.8)
  'flashcards',
  'memory',
  'bingo',
  'quick_sort',
  'forbidden_word',
  // Fluidez contra el agente (8.9)
  'taboo',
  'twenty_questions',
  'describe_guess',
  'chained_story',
  'debate',
  'random_topic',
  'role_play',
  'speed_speaking',
  // Comprensión y recuperación rápida (8.10)
  'shadowing',
  'partial_dictation',
  'listen_reformulate',
  'quick_qa',
  'recovery_drills',
] as const;
export type GameType = (typeof GAME_TYPES)[number];

export type GameFamily = 'vocab' | 'agent' | 'listening' | 'oral';

// [Juego → familia + motor del agente de FastAPI]: `agentGame` = GameType del motor determinista (persona game)
export const GAME_META: Readonly<
  Record<GameType, { family: GameFamily; skill: string; agentGame?: string }>
> = Object.freeze({
  flashcards: { family: 'vocab', skill: 'Memoria léxica' },
  memory: { family: 'vocab', skill: 'Asociación' },
  bingo: { family: 'vocab', skill: 'Reconocimiento auditivo' },
  quick_sort: { family: 'vocab', skill: 'Categorización' },
  forbidden_word: {
    family: 'agent',
    skill: 'Vocabulario activo',
    agentGame: 'taboo',
  },
  taboo: { family: 'agent', skill: 'Producción oral', agentGame: 'taboo' },
  twenty_questions: {
    family: 'agent',
    skill: 'Preguntas',
    agentGame: 'twenty_questions',
  },
  describe_guess: {
    family: 'agent',
    skill: 'Comprensión',
    agentGame: 'describe_guess',
  },
  chained_story: {
    family: 'agent',
    skill: 'Narración',
    agentGame: 'chained_story',
  },
  debate: { family: 'agent', skill: 'Argumentación', agentGame: 'debate' },
  random_topic: { family: 'oral', skill: 'Fluidez' },
  role_play: { family: 'agent', skill: 'Conversación', agentGame: 'role_play' },
  speed_speaking: { family: 'oral', skill: 'Fluidez' },
  shadowing: { family: 'listening', skill: 'Pronunciación' },
  partial_dictation: { family: 'listening', skill: 'Comprensión auditiva' },
  listen_reformulate: { family: 'listening', skill: 'Reformulación' },
  quick_qa: { family: 'listening', skill: 'Respuesta rápida' },
  recovery_drills: { family: 'vocab', skill: 'Recuperación rápida' },
});
