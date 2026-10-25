import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { formatEther } from 'viem';
import { explorerTxUrl } from '@core/web3/chains';
import { BadgeComponent, type BadgeTone } from '@shared/ui/atoms/badge/badge.component';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { shortAddress, type CryptoPayment, type CryptoStatus } from '../../domain/models/wallet';
// [CryptoPaymentComponent · Presentacional]: resumen del pago on-chain (monto en ETH de prueba, destinatario, billetera) + botón «Enviar» + estado y confirmaciones | [Patrón]: Presentational Component | [Principio]: SRP (la transacción la envía la fachada con viem) | [Paradigma]: Declarativo
// [UX]: estados claros de la transacción (PENDIENTE → CONFIRMANDO → PAGADO / FALLIDO / EXPIRADO) con texto, no solo color · enlace a Etherscan para verificar por cuenta propia
// [A11y]: <dl> para los datos · estado en role="status" (anunciado al cambiar)

const TONE: Record<CryptoStatus, BadgeTone> = { pending: 'warning', confirming: 'brand', paid: 'info', failed: 'danger', expired: 'muted' };

export interface CryptoPaymentTexts {
  amount: string;
  to: string;
  from: string;
  expires: string;
  tx: string;
  pay: (eth: string) => string;
  sending: string;
  confirmations: (n: number) => string;
  status: Record<CryptoStatus, string>;
}

@Component({
  selector: 'aula-crypto-payment',
  imports: [BadgeComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let p = payment();
    @let t = texts();
    <div class="space-y-4">
      <dl class="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt class="text-muted-foreground">{{ t.amount }}</dt><dd class="eeg-mono text-lg font-extrabold">{{ eth() }} ETH</dd></div>
        <div><dt class="text-muted-foreground">{{ t.expires }}</dt><dd><time [attr.datetime]="p.expiresAt">{{ expires() }}</time></dd></div>
        <div><dt class="text-muted-foreground">{{ t.to }}</dt><dd class="eeg-mono" [title]="p.toAddress">{{ short(p.toAddress) }}</dd></div>
        <div><dt class="text-muted-foreground">{{ t.from }}</dt><dd class="eeg-mono" [title]="p.walletAddress">{{ short(p.walletAddress) }}</dd></div>
      </dl>
      <div role="status" class="flex flex-wrap items-center gap-2">
        <aula-badge [tone]="tone()">{{ t.status[p.status] }}</aula-badge>
        @if (p.status === 'confirming' || p.status === 'paid') {
          <span class="text-sm text-muted-foreground">{{ t.confirmations(p.confirmations) }}</span>
        }
        @if (p.error) {
          <span class="text-sm text-tone-danger">{{ p.error }}</span>
        }
      </div>
      @if (p.txHash) {
        <p class="text-sm">{{ t.tx }}: <a class="eeg-mono text-primary hover:underline" [href]="txUrl()" target="_blank" rel="noopener noreferrer">{{ short(p.txHash) }}</a></p>
      }
      @if (p.status === 'pending') {
        <button aulaButton type="button" class="w-full sm:w-auto" [loading]="sending()" (click)="pay.emit()">{{ sending() ? t.sending : t.pay(eth()) }}</button>
      }
    </div>
  `,
})
export class CryptoPaymentComponent {
  readonly payment = input.required<CryptoPayment>();
  readonly sending = input(false);
  readonly locale = input('es-CO');
  readonly texts = input.required<CryptoPaymentTexts>();
  readonly pay = output<void>();

  // `formatEther` (viem): wei (bigint) → texto decimal exacto en ETH
  protected readonly eth = computed(() => formatEther(BigInt(this.payment().amountWei)));
  protected readonly tone = computed(() => TONE[this.payment().status]);
  protected readonly txUrl = computed(() => explorerTxUrl(this.payment().txHash ?? ''));
  protected readonly expires = computed(() => new Date(this.payment().expiresAt).toLocaleString(this.locale()));
  protected readonly short = shortAddress;
}
