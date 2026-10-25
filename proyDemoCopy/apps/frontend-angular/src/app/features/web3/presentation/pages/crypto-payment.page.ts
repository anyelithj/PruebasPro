import { BackLinkComponent } from '@shared/ui/atoms/back-link/back-link.component';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '@core/i18n/i18n.service';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { CryptoPaymentFacade } from '../../application/crypto-payment.facade';
import { WalletFacade } from '../../application/wallet.facade';
import { CRYPTO_STATUSES } from '../../domain/models/wallet';
import { ConnectWalletComponent, type ConnectWalletTexts } from '../components/connect-wallet.component';
import { CryptoPaymentComponent, type CryptoPaymentTexts } from '../components/crypto-payment.component';
// [CryptoPaymentPage · Presentación]: /checkout/cripto?orden=… (crea el pago y envía ETH de prueba) y /checkout/cripto/:id (estado y confirmaciones en vivo) | [Patrón]: Container + Máquina de estados + Observer (SSE) | [Principio]: SRP + DIP (fachadas) | [Paradigma]: Declarativo + Reactivo
// [Flujo]: orden de Payments → pago cripto PENDIENTE → billetera vinculada firma la transacción → hash al backend → el worker confirma → orden pagada (mismo FulfillOrder que Stripe)

@Component({
  selector: 'aula-crypto-payment-page',
  imports: [
    BackLinkComponent,CardPageTemplate, CryptoPaymentComponent, ConnectWalletComponent, ButtonComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let t = i18n.t().web3;
    <aula-card-page [heading]="t.cryptoTitle" [subtitle]="t.cryptoSubtitle">
      <p class="mb-4 text-xs text-muted-foreground">{{ t.network }}</p>
      @if (crypto.actionError() ?? wallet.actionError(); as err) {
        <p role="alert" class="mb-3 text-sm text-tone-danger">{{ err }}</p>
      }
      @if (!id() && !orden()) {
        <p class="text-sm">{{ t.noOrder }}</p>
        <a aulaBackLink href="/checkout">{{ t.backCheckout }}</a>
      } @else {
        @switch (crypto.payment.status()) {
          @case ('loading') {
            <aula-spinner [label]="i18n.t().common.loading" />
          }
          @case ('error') {
            <div role="alert" class="space-y-3 text-sm text-tone-danger">
              <p>{{ crypto.payment.error() }}</p>
              @if (needsWallet()) {
                <a aulaButton variant="outline" href="/wallet">{{ t.goWallet }}</a>
              }
            </div>
          }
          @default {
            @if (crypto.payment.data(); as p) {
              @if (p.status === 'pending' && !wallet.account()) {
                <div class="mb-4 rounded-xl border border-border bg-muted/40 p-4">
                  <p class="mb-2 text-sm font-semibold">{{ t.connectFirst }}</p>
                  <aula-connect-wallet [wallets]="wallet.discovered()" [texts]="connectTexts()" (picked)="wallet.connect($event)" (rediscover)="wallet.rediscover()" />
                </div>
              }
              <aula-crypto-payment [payment]="p" [sending]="crypto.sending()" [locale]="i18n.intl()" [texts]="paymentTexts()" (pay)="crypto.pay()" />
              @if (p.status === 'paid') {
                <a aulaButton class="mt-4" href="/courses">{{ t.goCourses }}</a>
              } @else if (p.status === 'failed' || p.status === 'expired') {
                <a aulaBackLink class="mt-4" href="/checkout">{{ t.backCheckout }}</a>
              }
            }
          }
        }
      }
    </aula-card-page>
  `,
})
export default class CryptoPaymentPage {
  protected readonly i18n = inject(I18nService);
  protected readonly crypto = inject(CryptoPaymentFacade);
  protected readonly wallet = inject(WalletFacade);
  private readonly router = inject(Router);
  readonly id = input<string>(); // /checkout/cripto/:id
  readonly orden = input<string>(); // ?orden=<orderId>

  // [needsWallet]: el backend responde 409 si no hay billetera vinculada → se ofrece el enlace a /wallet
  protected readonly needsWallet = computed(() => /billetera/i.test(this.crypto.payment.error() ?? ''));

  protected readonly paymentTexts = computed<CryptoPaymentTexts>(() => {
    const t = this.i18n.t().web3;
    const status = Object.fromEntries(CRYPTO_STATUSES.map((s) => [s, t.status[s]])) as CryptoPaymentTexts['status'];
    return {
      amount: t.amount,
      to: t.to,
      from: t.from,
      expires: t.expires,
      tx: t.tx,
      sending: t.sending,
      status,
      pay: (amount) => this.i18n.fmt(t.pay, { amount }),
      confirmations: (n) => this.i18n.fmt(t.confirmations, { n }),
    };
  });

  protected readonly connectTexts = computed<ConnectWalletTexts>(() => {
    const t = this.i18n.t().web3;
    return { heading: t.discovered, empty: t.noWallets, rediscover: t.rediscover, connect: (name) => this.i18n.fmt(t.connect, { name }) };
  });

  constructor() {
    this.crypto.connect(inject(DestroyRef));
    // [Entrada]: con :id se consulta; con ?orden se crea (idempotente en el backend) y la URL pasa a /checkout/cripto/:id (recargar no crea otro pago)
    effect(() => {
      const id = this.id();
      const orden = this.orden();
      untracked(() => {
        if (id) void this.crypto.load(id);
        else if (orden)
          void this.crypto.start(orden).then((p) => {
            if (p) void this.router.navigate(['/checkout/cripto', p.id], { replaceUrl: true });
          });
      });
    });
  }
}
