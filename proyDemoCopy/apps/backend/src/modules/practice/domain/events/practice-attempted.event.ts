// [Evento de dominio PracticeAttempted · Sprint 8.12]: un estudiante respondió un ítem → Score revisa logros (puntos por evento) sin que Practice lo conozca | [Patrón]: Domain Event + Observer | [Principio]: OCP | [Paradigma]: Event-Driven

export const PRACTICE_ATTEMPTED_EVENT = 'practice.attempted';

export class PracticeAttemptedEvent {
  constructor(
    public readonly userId: string,
    public readonly attemptId: string,
    public readonly correct: boolean,
    public readonly score: number, // 0..1
  ) {}
}
