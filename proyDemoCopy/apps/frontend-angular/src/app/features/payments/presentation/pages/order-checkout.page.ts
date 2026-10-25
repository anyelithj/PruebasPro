import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CartService } from '@core/cart/cart.service';
import { I18nService } from '@core/i18n/i18n.service';
import { BadgeComponent, type BadgeTone } from '@shared/ui/atoms/badge/badge.component';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { OrderFacade } from '../../application/order.facade';
import { paymentStatusResource } from '../../application/payment-status.resource';
import type { PaymentStatus } from '../../domain/models/payments';
import { CardPaymentComponent } from '../components/card-payment.component';
import { OrderSummaryComponent, type SummaryLine } from '../components/order-summary.component';
// [OrderCheckoutPage · Presentación]: /checkout (resumen del carrito → pago con tarjeta embebido) y /checkout/confirmacion/:orderId (estado con sondeo hasta que el webhook confirma) | [Patrón]: Container + Máquina de estados (carrito → orden → pago → confirmación) | [Principio]: SRP + DIP (fachada y resource) | [Paradigma]: Declarativo + Reactivo
// [Carrito]: el MISMO de Next.js (CartService, localStorage «cart») · [Seguridad]: el total que se cobra lo calcula el backend
// [A11y]: estados con texto (role="status"/"alert"), botones con nombre propio, foco en contenido · [Responsive]: una columna en móvil

const STATUS_TONE: Record<PaymentStatus, BadgeTone> = {
  pending: 'warning',
  succeeded: 'info',
  failed: 'danger',
  expired: 'muted',
  partially_refunded: 'brand',
  refunded: 'muted',
};

@Component({
  selector: 'aula-order-checkout-page',
  imports: [CardPageTemplate, OrderSummaryComponent, CardPaymentComponent, BadgeComponent, ButtonComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let t = i18n.t().payments;
    @if (orderId()) {
      <!-- ── Confirmación ── -->
      <aula-card-page [heading]="t.confirmTitle" [subtitle]="t.confirmSubtitle">
        @let p = status.hasValue() ? status.value() : undefined;
        @if (status.error()) {
          <p role="alert" class="text-sm text-tone-danger">{{ errorText(status.error()) }}</p>
        } @else if (!p) {
          <aula-spinner [label]="i18n.t().common.loading" />
        } @else {
          <div class="space-y-4" role="status">
            <aula-badge [tone]="tone(p.status)">{{ t.status[p.status] }}</aula-badge>
            @if (facade.order.data(); as order) {
              <aula-order-summary [heading]="t.summary" [totalLabel]="t.total" [lines]="linesOf(order.items)" [totalMinor]="order.totalMinor" [currency]="order.currency" [locale]="i18n.intl()" />
            }
            @if (p.status === 'succeeded') {
              <a aulaButton href="/courses">{{ t.goCourses }}</a>
            } @else if (p.status === 'failed' || p.status === 'expired') {
              <a aulaButton variant="outline" href="/checkout">{{ t.retry }}</a>
            }
          </div>
        }
      </aula-card-page>
    } @else {
      <!-- ── Checkout ── -->
      <aula-card-page [heading]="t.checkoutTitle" [subtitle]="t.checkoutSubtitle">
        @if (!cart.items().length && !demoDone()) {
          <div class="space-y-3 text-center">
            <p class="text-sm text-muted-foreground">{{ t.emptyCart }}</p>
            <a aulaButton variant="outline" href="/courses">{{ t.browse }}</a>
          </div>
        } @else if (demoDone()) {
          <div role="status" class="space-y-3">
            <p class="text-sm">{{ t.demoDone }}</p>
            <a aulaButton href="/courses">{{ t.goCourses }}</a>
          </div>
        } @else {
          <div class="grid gap-6 lg:grid-cols-[1fr_minmax(0,28rem)]">
            <aula-order-summary [heading]="t.summary" [totalLabel]="t.total" [lines]="cartLines()" [totalMinor]="cartTotalMinor()" [currency]="cart.currency()" [locale]="i18n.intl()" />
            <div class="space-y-3">
              @if (facade.order.error(); as err) {
                <p role="alert" class="text-sm text-tone-danger">{{ err }}</p>
              }
              @if (facade.actionError(); as err) {
                <p role="alert" class="text-sm text-tone-danger">{{ err }}</p>
              }
              @if (facade.demoMode()) {
                <div role="status" class="space-y-2 rounded-xl border border-border bg-muted/50 p-4 text-sm">
                  <b class="block">{{ t.demoTitle }}</b>
                  <p class="text-muted-foreground">{{ t.demoBody }}</p>
                  <button aulaButton type="button" [loading]="paying()" (click)="demoBuy()">{{ t.demoBuy }}</button>
                </div>
              } @else if (facade.session(); as s) {
                <p class="text-xs text-muted-foreground">{{ t.testMode }}</p>
                <aula-card-payment [clientSecret]="s.clientSecret" [publishableKey]="s.publishableKey" [label]="t.cardForm" (failed)="cardError.set($event)" />
                @if (cardError()) {
                  <p role="alert" class="text-sm text-tone-danger">{{ t.cardError }}</p>
                }
                <button aulaButton variant="ghost" size="sm" type="button" (click)="facade.cancel()">{{ t.cancel }}</button>
              } @else if (facade.order.data()?.status === 'cancelled') {
                <p role="status" class="text-sm text-muted-foreground">{{ t.cancelled }}</p>
                <button aulaButton type="button" (click)="pay()">{{ t.pay }}</button>
              } @else {
                <button aulaButton type="button" class="w-full" [loading]="facade.order.loading()" (click)="pay()">
                  {{ facade.order.loading() ? t.preparing : t.pay }}
                </button>
                <!-- [Sprint 7.7]: misma orden, pago on-chain en Sepolia con la billetera vinculada -->
                <button aulaButton variant="outline" type="button" class="w-full" [loading]="facade.order.loading()" (click)="payCrypto()">{{ t.payCrypto }}</button>
              }
            </div>
          </div>
        }
      </aula-card-page>
    }
  `,
})
export default class OrderCheckoutPage {
  protected readonly i18n = inject(I18nService);
  protected readonly facade = inject(OrderFacade);
  protected readonly cart = inject(CartService);
  private readonly router = inject(Router);
  // `input()` + withComponentInputBinding (app.config): parámetro de ruta :orderId y query ?pago=
  readonly orderId = input<string>();
  readonly pago = input<string>();
  protected readonly cardError = signal<string | null>(null);
  protected readonly paying = signal(false);
  protected readonly demoDone = signal(false);
  protected readonly status = paymentStatusResource(() => this.pago() ?? null);

  // [Carrito → líneas]: precios del navegador solo para MOSTRAR; el cobro usa los del servidor
  protected readonly cartLines = computed<SummaryLine[]>(() => this.cart.items().map((i) => ({ id: i.id, title: i.title, amountMinor: Math.round(i.price * 100) })));
  protected readonly cartTotalMinor = computed(() => this.cartLines().reduce((s, l) => s + l.amountMinor, 0));

  constructor() {
    // [Confirmación]: carga la orden y, cuando el pago queda confirmado, la relee y quita esos cursos del carrito
    effect(() => {
      const id = this.orderId();
      if (id) void this.facade.load(id);
    });
    effect(() => {
      const p = this.status.hasValue() ? this.status.value() : undefined;
      const id = this.orderId();
      if (p?.status === 'succeeded' && id) {
        void this.facade.load(id).then((o) => o?.items.forEach((i) => this.cart.remove(i.courseId)));
      }
    });
  }

  protected pay(): void {
    this.cardError.set(null);
    void this.facade.start(this.cart.items().map((i) => i.id));
  }

  // [payCrypto]: crea la orden y abre el pago con ETH de prueba (otra funcionalidad → navegación por el router, sin importarla)
  protected async payCrypto(): Promise<void> {
    const order = await this.facade.createOrder(this.cart.items().map((i) => i.id));
    if (order) void this.router.navigate(['/checkout/cripto'], { queryParams: { orden: order.id } });
  }

  // [demoBuy]: compra simulada (sin Stripe en el servidor) por /api/courses/:id/purchase
  protected async demoBuy(): Promise<void> {
    this.paying.set(true);
    const res = await this.cart.checkout();
    this.paying.set(false);
    if (!res.failed.length) this.demoDone.set(true);
    else this.facade.actionError.set(res.failed.join(', '));
  }

  protected linesOf(items: { courseId: string; title: string; amountMinor: number }[]): SummaryLine[] {
    return items.map((i) => ({ id: i.courseId, title: i.title, amountMinor: i.amountMinor }));
  }

  protected tone(s: PaymentStatus): BadgeTone {
    return STATUS_TONE[s];
  }

  protected errorText(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
