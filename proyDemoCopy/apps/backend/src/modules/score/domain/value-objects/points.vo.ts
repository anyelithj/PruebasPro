// [Value Object Points]: encapsula valor de puntos no-negativo | [Patron]: Value Object | [Principio]: SRP + LSP | [Paradigma]: POO

export class InvalidPointsError extends Error {
  constructor(value: number) {
    super(`Invalid points value: ${value} (must be >= 0)`);
    this.name = 'InvalidPointsError';
  }
}

export class Points {
  private constructor(public readonly value: number) {}

  static create(value: number): Points {
    if (!Number.isFinite(value) || value < 0)
      throw new InvalidPointsError(value);
    return new Points(Math.round(value));
  }

  add(other: Points): Points {
    return new Points(this.value + other.value);
  }

  equals(other: Points): boolean {
    return this.value === other.value;
  }
}
