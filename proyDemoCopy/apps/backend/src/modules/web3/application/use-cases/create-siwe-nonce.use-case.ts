import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { generateSiweNonce } from 'viem/siwe';
import { web3Config } from '../../../../shared/config/web3.config';
// [UseCase CreateSiweNonce · Sprint 7.6]: nonce SIWE (EIP-4361) de un solo uso con caducidad para vincular una billetera | [Patrón]: Use Case (Command) + Nonce (anti-replay) | [Principio]: SRP | [Paradigma]: POO + async/await
// [Almacén]: Redis (CACHE_MANAGER global) → funciona con varias instancias del backend · un nonce por usuario (pedir otro invalida el anterior)

export const SIWE_NONCE_TTL_MS = 5 * 60_000; // 5 minutos para firmar
export const siweNonceKey = (userId: string) => `siwe:nonce:${userId}`;

export interface SiweChallenge {
  nonce: string;
  domain: string; // El mensaje firmado debe nombrar este dominio (anti-phishing)
  uri: string;
  chainId: number;
  statement: string;
}

@Injectable()
export class CreateSiweNonceUseCase {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async execute(userId: string): Promise<SiweChallenge> {
    const nonce = generateSiweNonce(); // `generateSiweNonce` (viem): 96 bits aleatorios alfanuméricos
    await this.cache.set(siweNonceKey(userId), nonce, SIWE_NONCE_TTL_MS);
    const cfg = web3Config();
    return {
      nonce,
      domain: cfg.siweDomain,
      uri: cfg.siweUri,
      chainId: cfg.chainId,
      statement:
        'Vincular esta billetera a mi cuenta de Aula de Idiomas (sin custodia de claves).',
    };
  }
}
