// [Value Object Email]: encapsula reglas de validez de email | [Patrón]: Value Object | [Principio]: SRP + LSP | [Paradigma]: POO

// [Regex RFC pragmático]: cubre 99% casos reales sin parser completo (RFC 5321 es excesivo)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// [Error de dominio]: específico, evita anidamiento con HttpException (Domain no conoce HTTP)
export class InvalidEmailError extends Error {
  constructor(value: string) {
    super(`Invalid email: ${value}`);
    this.name = 'InvalidEmailError';
  }
}

// [Inmutable]: readonly value + normalización en construcción | [Principio]: inmutabilidad
export class Email {
  // [Constructor privado]: fuerza uso del factory create() para validar
  private constructor(public readonly value: string) {}

  // [Factory de creación]: única vía de instanciación válida | [Patrón]: Factory Method
  static create(raw: string): Email {
    // [Normalización]: trim + lowercase — email es case-insensitive en local-part por convención práctica
    const normalized = raw.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalized)) throw new InvalidEmailError(raw);
    return new Email(normalized);
  }

  // [Igualdad estructural]: VOs se comparan por valor, no por identidad
  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
