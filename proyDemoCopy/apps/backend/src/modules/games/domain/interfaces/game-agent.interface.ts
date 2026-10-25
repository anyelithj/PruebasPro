// [Ports GameAgentPort + SpeechPort · Sprint 8.5]: turnos con el agente de juegos (FastAPI Assistant, persona «game») y voz a texto/fluidez (FastAPI Speech) sin que los casos de uso conozcan HTTP | [Patrón]: Port (Hexagonal) | [Principio]: DIP + ISP | [Paradigma]: POO

export const GAME_AGENT = Symbol('GAME_AGENT');
export const SPEECH = Symbol('SPEECH');

// [GameContext]: espejo del Value Object de FastAPI (assistant/domain/value_objects/game_context.py)
export interface GameContextDto {
  game: string;
  turn: number;
  max_turns: number;
  target?: string | null;
  forbidden?: string[];
  topic?: string | null;
  vocabulary?: string[];
  role?: string | null;
  objectives?: { id: string; text: string; keywords: string[] }[];
  met?: string[];
}

export interface AgentTurn {
  sessionId: string; // Conversación de FastAPI (memoria del agente)
  reply: string;
  answeredBy: string; // engine | llm | none
  state: Record<string, unknown>; // solved, violation, met, finished, questions_left…
}

export interface GameAgentPort {
  turn(
    input: {
      message: string;
      conversationId?: string | null;
      language: string;
      level?: string | null;
      game: GameContextDto;
    },
    token: string,
  ): Promise<AgentTurn>;
}

export interface WordStamp {
  word: string;
  start: number;
  end: number;
}

export interface FluencyResult {
  time_to_respond_s: number;
  speaking_time_s: number;
  pauses: number;
  longest_run_s: number;
  words_produced: number;
  words_per_minute: number;
  reused_vocabulary: string[];
  reuse_ratio: number;
}

export interface SpeechPort {
  transcribe(
    audio: Buffer,
    mime: string,
    language: string | undefined,
    token: string,
  ): Promise<{
    text: string;
    language: string;
    duration: number;
    words: WordStamp[];
    model: string;
  }>;
  fluency(
    input: {
      words: WordStamp[];
      prompt_end_s: number;
      target_vocabulary: string[];
    },
    token: string,
  ): Promise<FluencyResult>;
}
