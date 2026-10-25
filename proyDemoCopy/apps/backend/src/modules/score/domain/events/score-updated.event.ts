// [Domain Event ScoreUpdated]: nuevo Score persistido | [Patron]: Observer | [Paradigma]: Event-Driven

export const SCORE_UPDATED_EVENT = 'score.updated';

export class ScoreUpdatedEvent {
  constructor(
    public readonly userId: string,
    public readonly scoreId: string,
    public readonly points: number,
    public readonly accuracy: number,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
