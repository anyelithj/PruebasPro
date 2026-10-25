// [Evento de dominio DialogueSessionCompleted · Sprint 9.3 · RF-122]: una conversación con el avatar terminó → Score revisa los logros sin que Dialogues lo conozca | [Patrón]: Domain Event + Observer | [Principio]: OCP (suscriptores nuevos sin tocar el productor) | [Paradigma]: Event-Driven

export const DIALOGUE_SESSION_COMPLETED_EVENT = 'dialogues.session-completed';

export class DialogueSessionCompletedEvent {
  constructor(
    public readonly sessionId: string,
    public readonly userId: string,
    public readonly userTurns: number,
    public readonly vocabularyCoverage: number, // 0..100: vocabulario clave del tema que el usuario usó
  ) {}
}
