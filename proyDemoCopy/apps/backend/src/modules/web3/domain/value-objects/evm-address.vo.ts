import { getAddress, isAddress } from 'viem';
// [VO EvmAddress · Sprint 7.6]: dirección Ethereum validada y normalizada con checksum EIP-55 → comparar direcciones nunca falla por mayúsculas | [Patrón]: Value Object (DDD) + Factory Method | [Principio]: SRP + inmutabilidad | [Paradigma]: POO
// [Tecnología]: viem (`isAddress`, `getAddress`)

export class EvmAddress {
  private constructor(public readonly value: `0x${string}`) {}

  // [parse]: lanza si no es una dirección de 20 bytes | `strict: false` acepta minúsculas y la normaliza
  static parse(raw: string): EvmAddress {
    if (!isAddress(raw, { strict: false }))
      throw new Error('Dirección EVM inválida');
    return new EvmAddress(getAddress(raw));
  }

  equals(other: string | EvmAddress | null | undefined): boolean {
    if (!other) return false;
    const v = typeof other === 'string' ? other : other.value;
    return isAddress(v, { strict: false }) && getAddress(v) === this.value;
  }

  toString(): string {
    return this.value;
  }
}
