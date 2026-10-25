// [Evento de dominio GameCompleted · Sprint 8.5]: una partida terminó → Score revisa los logros sin que Games lo conozca | [Patrón]: Domain Event + Observer | [Principio]: OCP (suscriptores nuevos sin tocar el productor) | [Paradigma]: Event-Driven

export const GAME_COMPLETED_EVENT = 'games.completed';

export class GameCompletedEvent {
  constructor(
    public readonly sessionId: string,
    public readonly userId: string,
    public readonly gameType: string,
    public readonly score: number,
    public readonly accuracy: number, // 0..100 (rondas correctas / rondas evaluables)
  ) {}
}
