// [Domain Event QuizCompleted]: sesión terminada — listener Score lo procesa | [Patrón]: Observer | [Principio]: SRP | [Paradigma]: Event-Driven

export const QUIZ_COMPLETED_EVENT = 'quiz.completed';

export class QuizCompletedEvent {
  constructor(
    public readonly sessionId: string,
    public readonly userId: string,
    public readonly quizId: string,
    public readonly totalScore: number,
    public readonly correctCount: number,
    public readonly totalQuestions: number,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
