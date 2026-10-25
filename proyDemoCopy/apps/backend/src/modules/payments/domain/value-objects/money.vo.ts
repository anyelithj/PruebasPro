// [VO Money · Sprint 7.3]: monto en unidades mínimas (centavos) + moneda ISO 4217 → sin errores de coma flotante al sumar o reembolsar | [Patrón]: Value Object (DDD) + Factory Method | [Principio]: SRP + inmutabilidad | [Paradigma]: POO

export class Money {
  // `private constructor` (TS): solo se crea por las fábricas → siempre válido
  private constructor(
    public readonly amountMinor: number,
    public readonly currency: string,
  ) {}

  // [of]: unidades mínimas (lo que guarda la BD y espera Stripe en `unit_amount`)
  static of(amountMinor: number, currency: string): Money {
    if (!Number.isInteger(amountMinor) || amountMinor < 0)
      throw new Error('Money: el monto debe ser un entero >= 0 (centavos)');
    if (!/^[A-Za-z]{3}$/.test(currency))
      throw new Error('Money: la moneda debe ser un código ISO 4217');
    return new Money(amountMinor, currency.toUpperCase());
  }

  // [fromMajor]: precio del catálogo (decimal, p. ej. 19.99) → 1999 | `Math.round` evita 1998.9999
  static fromMajor(amount: number, currency: string): Money {
    return Money.of(Math.round(amount * 100), currency);
  }

  // [add]: suma de la misma moneda (una orden no mezcla monedas) | devuelve un valor nuevo (inmutable)
  add(other: Money): Money {
    if (other.currency !== this.currency)
      throw new Error('Money: no se pueden sumar monedas distintas');
    return new Money(this.amountMinor + other.amountMinor, this.currency);
  }

  get isZero(): boolean {
    return this.amountMinor === 0;
  }

  // [Stripe]: la API espera la moneda en minúsculas
  get stripeCurrency(): string {
    return this.currency.toLowerCase();
  }
}
