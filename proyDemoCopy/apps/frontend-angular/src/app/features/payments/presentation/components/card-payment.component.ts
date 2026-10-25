import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { loadStripe } from '@stripe/stripe-js';
// [CardPaymentComponent · Presentacional]: monta el checkout EMBEBIDO de Stripe (Checkout Sessions, `ui_mode: 'embedded_page'`) dentro de la pantalla | [Patrón]: Adapter (Stripe.js → componente Angular) + Lifecycle (mount/destroy) | [Principio]: SRP + seguridad PCI (la tarjeta va directo a Stripe en su iframe, nunca a nuestros servidores) | [Paradigma]: Declarativo + async/await
// [Tecnología]: @stripe/stripe-js carga Stripe.js desde js.stripe.com (requisito de Stripe: no se empaqueta ni se aloja aquí)
// [Flujo]: al pagar, Stripe redirige a la `return_url` (/checkout/confirmacion/:orderId?pago=…) que fijó el backend

@Component({
  selector: 'aula-card-payment',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Stripe inserta aquí su iframe | aria-label: el contenedor tiene nombre aunque el iframe tarde en cargar -->
    <div #host role="region" [attr.aria-label]="label()" class="min-h-64 rounded-xl border border-border bg-white p-2"></div>
  `,
})
export class CardPaymentComponent {
  readonly clientSecret = input.required<string>();
  readonly publishableKey = input.required<string>();
  readonly label = input.required<string>();
  readonly failed = output<string>(); // La página muestra el error y permite reintentar
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');

  constructor() {
    let destroyed = false; // `let`: el componente puede destruirse mientras Stripe.js carga
    let checkout: { destroy(): void } | null = null;
    // `afterNextRender` (Angular): el <div> ya existe en el DOM → se puede montar | solo en el navegador
    afterNextRender(async () => {
      try {
        const stripe = await loadStripe(this.publishableKey());
        if (!stripe || destroyed) return;
        const secret = this.clientSecret();
        const instance = await stripe.createEmbeddedCheckoutPage({ fetchClientSecret: () => Promise.resolve(secret) });
        if (destroyed) return instance.destroy();
        instance.mount(this.host().nativeElement);
        checkout = instance;
      } catch (err) {
        this.failed.emit(err instanceof Error ? err.message : String(err));
      }
    });
    // [Limpieza]: Stripe exige `destroy()` antes de montar otro checkout en la misma página
    inject(DestroyRef).onDestroy(() => {
      destroyed = true;
      checkout?.destroy();
    });
  }
}
