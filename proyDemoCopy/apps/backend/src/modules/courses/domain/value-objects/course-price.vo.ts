// [VO CoursePrice]: precio inmutable con regla de gratuidad y promoción | [Patrón]: Value Object (DDD) | [Principio]: SRP + OCP | [Paradigma]: POO

export class CoursePrice {
  private constructor(
    public readonly amount: number,
    public readonly originalAmount: number | null,
    public readonly currency: string,
  ) {}

  // [Factory]: punto único de creación con validación | [Patrón]: Factory Method
  static create(
    amount: number,
    originalAmount: number | null = null,
    currency = 'USD',
  ): CoursePrice {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error('CoursePrice: amount debe ser número finito >= 0');
    }
    if (
      originalAmount !== null &&
      (!Number.isFinite(originalAmount) || originalAmount < amount)
    ) {
      throw new Error(
        'CoursePrice: originalAmount inválido (debe ser >= amount)',
      );
    }
    if (currency.length !== 3) {
      throw new Error(
        'CoursePrice: currency debe ser código ISO 4217 de 3 letras',
      );
    }
    return new CoursePrice(amount, originalAmount, currency.toUpperCase());
  }

  static free(): CoursePrice {
    return new CoursePrice(0, null, 'USD');
  }

  get isFree(): boolean {
    return this.amount === 0;
  }

  // [Equivalencia en TNA tokens]: 1 USD = 8 TNA (regla actual de la plataforma) | [SSOT]: regla coincide con frontend
  get tokens(): number {
    return Math.round(this.amount * 8);
  }

  // [Porcentaje de descuento]: 0 si no hay precio original | [Principio]: SRP
  get discountPercent(): number {
    if (!this.originalAmount || this.amount === 0) return 0;
    return Math.round((1 - this.amount / this.originalAmount) * 100);
  }
}
