import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Cache } from 'cache-manager';
import { Repository } from 'typeorm';
import { verifyMessage } from 'viem';
import { parseSiweMessage, validateSiweMessage } from 'viem/siwe';
import { web3Config } from '../../../../shared/config/web3.config';
import { Wallet } from '../../domain/entities/wallet.entity';
import { EvmAddress } from '../../domain/value-objects/evm-address.vo';
import { siweNonceKey } from './create-siwe-nonce.use-case';
// [UseCases LinkWallet + ListMyWallets + GetWallet · Sprint 7.6]: verifica la firma SIWE (EIP-4361) y vincula la billetera al usuario; consulta de billeteras | [Patrón]: Use Case (Command) + Query (CQRS ligero) | [Principio]: SRP + Fail Fast | [Paradigma]: POO + async/await
// [Seguridad]: dominio, red, nonce de un solo uso y caducidad del mensaje + firma ECDSA (`verifyMessage`) → nadie vincula una dirección que no controla
// ponytail: `verifyMessage` cubre cuentas EOA (MetaMask, Rabby…); billeteras de contrato (EIP-1271) requerirían `verifySiweMessage` con el cliente público

@Injectable()
export class LinkWalletUseCase {
  constructor(
    @InjectRepository(Wallet) private readonly wallets: Repository<Wallet>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async execute(
    userId: string,
    message: string,
    signature: `0x${string}`,
  ): Promise<Wallet> {
    const cfg = web3Config();
    const nonce = await this.cache.get<string>(siweNonceKey(userId));
    if (!nonce)
      throw new BadRequestException('El reto de firma caducó: pide uno nuevo');
    const parsed = parseSiweMessage(message);
    // `validateSiweMessage` (viem): dominio, nonce y vigencia (expirationTime / notBefore)
    if (
      !parsed.address ||
      !validateSiweMessage({
        message: parsed,
        domain: cfg.siweDomain,
        nonce,
      }) ||
      parsed.chainId !== cfg.chainId
    )
      throw new BadRequestException(
        'Mensaje SIWE inválido (dominio, red, nonce o vigencia)',
      );
    const valid = await verifyMessage({
      address: parsed.address,
      message,
      signature,
    }).catch(() => false);
    if (!valid)
      throw new BadRequestException('La firma no corresponde a la dirección');
    await this.cache.del(siweNonceKey(userId)); // [Un solo uso]: el mismo mensaje no se puede reenviar

    const address = EvmAddress.parse(parsed.address).value;
    const existing = await this.wallets.findOneBy({ address });
    if (existing && existing.userId !== userId)
      throw new ConflictException(
        'Esta billetera ya está vinculada a otra cuenta',
      );
    return (
      existing ??
      this.wallets.save(
        this.wallets.create({ userId, address, chainId: cfg.chainId }),
      )
    );
  }
}

@Injectable()
export class ListMyWalletsUseCase {
  constructor(
    @InjectRepository(Wallet) private readonly wallets: Repository<Wallet>,
  ) {}

  execute(userId: string): Promise<Wallet[]> {
    return this.wallets.find({
      where: { userId },
      order: { linkedAt: 'DESC' },
    });
  }
}

@Injectable()
export class GetWalletUseCase {
  constructor(
    @InjectRepository(Wallet) private readonly wallets: Repository<Wallet>,
  ) {}

  // [Seguridad]: una billetera ajena responde 404
  async execute(userId: string, id: string): Promise<Wallet> {
    const wallet = await this.wallets.findOneBy({ id, userId });
    if (!wallet) throw new NotFoundException('Billetera no encontrada');
    return wallet;
  }
}
