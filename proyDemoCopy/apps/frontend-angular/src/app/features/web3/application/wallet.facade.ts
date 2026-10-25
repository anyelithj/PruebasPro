import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { createSiweMessage } from 'viem/siwe';
import { ViemClient, type DiscoveredWallet } from '@core/web3/viem-client';
import { AsyncState } from '@shared/utils/async-state';
import { WalletRepository } from '../domain/wallet.repository.port';
import type { LinkedWallet } from '../domain/models/wallet';
// [WalletFacade · Aplicación]: casos de uso «conectar y vincular con SIWE», «listar» y «desvincular» | [Patrón]: Facade + State Machine | [Principio]: SRP + DIP (puerto + ViemClient de core) | [Paradigma]: Reactivo (signals) + async/await
// [Flujo SIWE · EIP-4361]: reto del servidor (nonce, dominio, red) → mensaje estándar → firma en la billetera → el servidor verifica y vincula

const SIWE_VALID_MS = 5 * 60_000; // Igual que la caducidad del nonce en NestJS

@Injectable()
export class WalletFacade {
  private readonly repo = inject(WalletRepository);
  private readonly viem = inject(ViemClient);

  readonly wallets = new AsyncState<LinkedWallet[]>((rows) => rows.length === 0);
  readonly linking = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly discovered = this.viem.wallets; // Billeteras anunciadas por EIP-6963
  readonly account = this.viem.account;

  load(): Promise<LinkedWallet[] | null> {
    return this.wallets.run(this.repo.mine());
  }

  rediscover(): void {
    this.viem.discover();
  }

  // [connect]: solo conecta (sin firmar SIWE) — para pagar con una billetera que ya está vinculada
  async connect(wallet: DiscoveredWallet): Promise<void> {
    this.actionError.set(null);
    try {
      await this.viem.connect(wallet);
    } catch (err) {
      this.actionError.set(err instanceof Error ? err.message : String(err));
    }
  }

  async connectAndLink(wallet: DiscoveredWallet): Promise<LinkedWallet | null> {
    this.linking.set(true);
    this.actionError.set(null);
    try {
      const address = await this.viem.connect(wallet);
      const c = await firstValueFrom(this.repo.nonce());
      const now = new Date();
      // `createSiweMessage` (viem): texto EIP-4361 exacto que valida `parseSiweMessage` en el servidor
      const message = createSiweMessage({
        address,
        chainId: c.chainId,
        domain: c.domain,
        nonce: c.nonce,
        uri: c.uri,
        statement: c.statement,
        version: '1',
        issuedAt: now,
        expirationTime: new Date(now.getTime() + SIWE_VALID_MS),
      });
      const signature = await this.viem.signMessage(message);
      const linked = await firstValueFrom(this.repo.verify(message, signature));
      const rest = (this.wallets.data() ?? []).filter((w) => w.id !== linked.id);
      this.wallets.set([linked, ...rest]);
      return linked;
    } catch (err) {
      this.actionError.set(err instanceof Error ? err.message : String(err)); // Rechazo en la billetera incluido
      return null;
    } finally {
      this.linking.set(false);
    }
  }

  async unlink(id: string): Promise<void> {
    this.actionError.set(null);
    try {
      await firstValueFrom(this.repo.unlink(id));
      this.wallets.set((this.wallets.data() ?? []).filter((w) => w.id !== id));
    } catch (err) {
      this.actionError.set(err instanceof Error ? err.message : String(err));
    }
  }
}
