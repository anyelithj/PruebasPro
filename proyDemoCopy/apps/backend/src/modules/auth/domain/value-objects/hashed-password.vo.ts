// [Value Object HashedPassword]: contiene un hash bcrypt, nunca el plano | [Patrón]: Value Object | [Principio]: SRP + LSP | [Paradigma]: POO

// [Prefijo bcrypt]: identifica versiones del algoritmo (2a, 2b, 2y)
const BCRYPT_PREFIX_REGEX = /^\$2[aby]\$\d{2}\$/;

// [Error de dominio]: específico para hash inválido (no HTTP — Domain no conoce HTTP)
export class InvalidPasswordHashError extends Error {
  constructor() {
    super('Invalid bcrypt password hash');
    this.name = 'InvalidPasswordHashError';
  }
}

// [Inmutable]: representa una credencial ya hasheada | [Principio]: inmutabilidad
export class HashedPassword {
  private constructor(public readonly value: string) {}

  // [fromHash]: aceptar un hash ya generado por bcrypt | [Patrón]: Factory Method
  static fromHash(hash: string): HashedPassword {
    if (!BCRYPT_PREFIX_REGEX.test(hash)) throw new InvalidPasswordHashError();
    return new HashedPassword(hash);
  }

  // [Igualdad estructural]: por contenido del hash
  equals(other: HashedPassword): boolean {
    return this.value === other.value;
  }
}
