import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '@core/http/error.interceptor';
import { AsyncState } from '@shared/utils/async-state';
import { PaymentsRepository } from '../domain/payments.repository.port';
import type { CheckoutSession, Order } from '../domain/models/payments';
// [OrderFacade · Aplicación]: casos de uso «crear orden desde el carrito», «abrir el pago», «cancelar» y «ver la orden» | [Patrón]: Facade + State Machine (AsyncState) | [Principio]: SRP + DIP (depende del puerto) | [Paradigma]: Reactivo (signals) + async/await
// [Modo demostración]: si el backend no tiene claves de Stripe (503) se cancela la orden y la página ofrece la compra simulada de siempre

@Injectable()
export class OrderFacade {
  private readonly repo = inject(PaymentsRepository);

  readonly order = new AsyncState<Order>();
  readonly session = signal<CheckoutSession | null>(null);
  readonly demoMode = signal(false); // true = pagos sin configurar en el servidor
  readonly actionError = signal<string | null>(null);

  // [start]: orden (total calculado en el servidor) → sesión de pago embebida
  async start(courseIds: string[]): Promise<void> {
    this.actionError.set(null);
    this.session.set(null);
    const order = await this.order.run(this.repo.createOrder(courseIds));
    if (!order) return; // El error ya quedó en `order.error()`
    try {
      this.session.set(await firstValueFrom(this.repo.createCheckoutSession(order.id)));
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        this.demoMode.set(true);
        await this.cancel(); // Sin pasarela la orden no se podrá pagar → no se deja colgada
        return;
      }
      this.actionError.set(err instanceof Error ? err.message : String(err));
    }
  }

  // [createOrder]: solo la orden (sin sesión de Stripe) → la usa el pago con ETH de prueba (/checkout/cripto)
  createOrder(courseIds: string[]): Promise<Order | null> {
    this.actionError.set(null);
    return this.order.run(this.repo.createOrder(courseIds));
  }

  // [cancel]: orden pendiente → cancelada (botón «Cancelar» o modo demostración)
  async cancel(): Promise<void> {
    const current = this.order.data();
    if (!current || current.status !== 'pending') return;
    try {
      this.order.set(await firstValueFrom(this.repo.cancelOrder(current.id)));
      this.session.set(null);
    } catch (err) {
      this.actionError.set(err instanceof Error ? err.message : String(err));
    }
  }

  // [load]: orden de la pantalla de confirmación (se relee cuando el pago cambia de estado)
  load(id: string): Promise<Order | null> {
    return this.order.run(this.repo.order(id));
  }
}
