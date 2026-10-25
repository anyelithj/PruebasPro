// [Domain Event QuizStarted]: usuario inicia una sesión | [Patrón]: Observer | [Paradigma]: Event-Driven

export const QUIZ_STARTED_EVENT = 'quiz.started';

export class QuizStartedEvent {
  constructor(
    public readonly sessionId: string,
    public readonly userId: string,
    public readonly quizId: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
