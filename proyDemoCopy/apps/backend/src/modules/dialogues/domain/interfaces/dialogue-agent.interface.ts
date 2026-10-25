// [Port DialogueAgentPort · Sprints 9.3/9.6 · RF-122]: turnos con el avatar de conversación (FastAPI Assistant, persona «dialogue») sin que los casos de uso conozcan HTTP | [Patrón]: Port (Hexagonal) | [Principio]: DIP + ISP | [Paradigma]: POO

export const DIALOGUE_AGENT = Symbol('DIALOGUE_AGENT');
export const START_MESSAGE = '__start__'; // FastAPI responde con la apertura determinista del tema (sin LLM)

// [DialogueContext]: espejo del Value Object de FastAPI (assistant/domain/value_objects/topic_script.py)
export interface DialogueContextDto {
  topic: string; // slug
  title: string;
  objectives: string[];
  vocabulary: string[];
  turn: number;
  opening?: string | null;
}

export interface AvatarTurn {
  sessionId: string; // Conversación de FastAPI (memoria del agente)
  reply: string;
  answeredBy: string; // engine | llm | none
  correction: string | null;
  translation?: string | null; // [2026-10-20]: traducción al español que da el propio avatar (respaldo si LanguageTools no traduce)
  learnerTranslation?: string | null; // [2026-10-23]: traducción del mensaje del usuario en la misma llamada (respaldo de su turno)
  vocabularyUsed: string[];
  finished?: boolean; // [2026-10-23]: el usuario se despidió → el caso de uso cierra la sesión
}

export interface DialogueAgentPort {
  turn(
    input: {
      message: string;
      conversationId?: string | null;
      language: string;
      level: string;
      dialogue: DialogueContextDto;
    },
    token: string,
  ): Promise<AvatarTurn>;
}
