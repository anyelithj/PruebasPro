import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AsyncState } from '@shared/utils/async-state';
import { PaymentsRepository } from '../domain/payments.repository.port';
import type { Payment, Refund } from '../domain/models/payments';
// [PaymentsFacade · Aplicación]: casos de uso «listar mis pagos» y «reembolsar» (ADMIN) | [Patrón]: Facade + State Machine | [Principio]: SRP + DIP | [Paradigma]: Reactivo (signals) + async/await
// [UX]: tras reembolsar se relee el pago (estado y monto reembolsado) en vez de adivinarlo en el cliente

@Injectable()
export class PaymentsFacade {
  private readonly repo = inject(PaymentsRepository);

  readonly payments = new AsyncState<Payment[]>((rows) => rows.length === 0);
  readonly refunding = signal(false);
  readonly actionError = signal<string | null>(null);

  load(): Promise<Payment[] | null> {
    return this.payments.run(this.repo.myPayments());
  }

  async refund(paymentId: string, amountMinor?: number, reason?: string): Promise<Refund | null> {
    this.refunding.set(true);
    this.actionError.set(null);
    try {
      const refund = await firstValueFrom(this.repo.refund(paymentId, amountMinor, reason));
      const updated = await firstValueFrom(this.repo.paymentStatus(paymentId));
      this.payments.set((this.payments.data() ?? []).map((p) => (p.id === paymentId ? updated : p)));
      return refund;
    } catch (err) {
      this.actionError.set(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      this.refunding.set(false);
    }
  }
}
