// [Domain Event QuizCreated]: emitido al persistir un Quiz nuevo | [Patrón]: Observer + Domain Event | [Principio]: SRP | [Paradigma]: Event-Driven

export const QUIZ_CREATED_EVENT = 'quiz.created';

export class QuizCreatedEvent {
  constructor(
    public readonly quizId: string,
    public readonly authorId: string,
    public readonly title: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
