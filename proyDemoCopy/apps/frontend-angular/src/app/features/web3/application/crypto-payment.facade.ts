import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { ViemClient } from '@core/web3/viem-client';
import { AsyncState } from '@shared/utils/async-state';
import { WalletRepository } from '../domain/wallet.repository.port';
import { applyProgress, sameAddress, type CryptoPayment } from '../domain/models/wallet';
// [CryptoPaymentFacade · Aplicación]: casos de uso «crear el pago cripto», «enviar ETH de prueba con la billetera» y «seguir las confirmaciones» | [Patrón]: Facade + State Machine (PENDIENTE → CONFIRMANDO → PAGADO / FALLIDO / EXPIRADO) + Observer (SSE) | [Principio]: SRP + DIP | [Paradigma]: Reactivo + async/await
// [Regla]: la transacción debe salir de la billetera VINCULADA (el backend la rechaza si no) → se avisa antes de pedir la firma

@Injectable()
export class CryptoPaymentFacade {
  private readonly repo = inject(WalletRepository);
  private readonly viem = inject(ViemClient);

  readonly payment = new AsyncState<CryptoPayment>();
  readonly sending = signal(false);
  readonly actionError = signal<string | null>(null);

  start(orderId: string): Promise<CryptoPayment | null> {
    return this.payment.run(this.repo.createCryptoPayment(orderId));
  }

  load(id: string): Promise<CryptoPayment | null> {
    return this.payment.run(this.repo.cryptoPayment(id));
  }

  // [connect]: confirmaciones en vivo mientras viva la pantalla | `takeUntilDestroyed` cierra el SSE
  connect(destroyRef: DestroyRef): void {
    this.repo
      .progress()
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe({
        next: (e) => {
          const p = this.payment.data();
          if (p) this.payment.set(applyProgress(p, e));
        },
        error: () => undefined, // EventSource reintenta solo
      });
  }

  // [pay]: `sendTransaction` en la billetera (el usuario confirma) → hash al backend → el worker verifica
  async pay(): Promise<void> {
    const p = this.payment.data();
    if (!p || p.status !== 'pending') return;
    this.actionError.set(null);
    if (!sameAddress(this.viem.account(), p.walletAddress)) {
      this.actionError.set(`Conecta la billetera vinculada ${p.walletAddress} para pagar`);
      return;
    }
    this.sending.set(true);
    try {
      const hash = await this.viem.sendTransaction(p.toAddress as `0x${string}`, BigInt(p.amountWei));
      this.payment.set(await firstValueFrom(this.repo.registerTx(p.id, hash)));
    } catch (err) {
      this.actionError.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.sending.set(false);
    }
  }
}
