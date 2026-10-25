import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { SessionService } from '@core/auth/session.service';
import { API_URL } from '@core/http/api-url.token';
import { I18nService } from '@core/i18n/i18n.service';
import { BadgeComponent, type BadgeTone } from '@shared/ui/atoms/badge/badge.component';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { DataTableComponent, type DataColumn } from '@shared/ui/organisms/data-table/data-table.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { PaymentsFacade } from '../../application/payments.facade';
import { formatMoney, refundable, type Payment, type PaymentStatus } from '../../domain/models/payments';
import { RefundDialogComponent, type RefundRequest, type RefundTexts } from '../components/refund-dialog.component';
// [PaymentsPage · Presentación]: /pagos (historial) y /pagos/:id (detalle) + reembolso para ADMIN | [Patrón]: Container + Template Method (celdas de DataTable) + Máquina de estados | [Principio]: SRP + DIP + DRY (DataTable y Badge compartidos) | [Paradigma]: Declarativo + Reactivo
// [A11y]: estados con texto (no solo color), tabla con caption, acciones con nombre accesible por fila · [Seguridad]: el botón de reembolso solo aparece a ADMIN y el backend vuelve a exigir el rol

const STATUS_TONE: Record<PaymentStatus, BadgeTone> = {
  pending: 'warning',
  succeeded: 'info',
  failed: 'danger',
  expired: 'muted',
  partially_refunded: 'brand',
  refunded: 'muted',
};

@Component({
  selector: 'aula-payments-page',
  imports: [IconComponent, CardPageTemplate, DataTableComponent, BadgeComponent, ButtonComponent, SpinnerComponent, RefundDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let t = i18n.t().payments;
    <aula-card-page [heading]="t.historyTitle" [subtitle]="t.historySubtitle">
      @if (facade.actionError(); as err) {
        <p role="alert" class="mb-3 text-sm text-tone-danger">{{ err }}</p>
      }
      @if (selected(); as p) {
        <!-- [Detalle]: /pagos/:id -->
        <section aria-labelledby="payment-detail" class="mb-4 space-y-1 rounded-xl border border-border bg-muted/40 p-4 text-sm">
          <h2 id="payment-detail" class="font-bold">{{ t.detail }}</h2>
          <p>{{ t.order }}: <span class="eeg-mono">{{ p.orderId }}</span></p>
          <p>{{ t.amount }}: {{ money(p.amountMinor, p.currency) }} · {{ t.refunded }}: {{ money(p.refundedMinor, p.currency) }}</p>
          <aula-badge [tone]="tone(p.status)">{{ t.status[p.status] }}</aula-badge>
        </section>
      }
      @switch (facade.payments.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <div role="alert" class="space-y-2 text-sm text-tone-danger">
            <p>{{ facade.payments.error() }}</p>
            <button aulaButton variant="outline" size="sm" type="button" (click)="facade.load()">{{ i18n.t().common.retry }}</button>
          </div>
        }
        @default {
          <aula-data-table [caption]="t.historyTitle" [columns]="columns()" [rows]="facade.payments.data() ?? []" [empty]="t.historyEmpty" [trackBy]="byId">
            <ng-template #cell let-row let-column="column">
              @switch (column) {
                @case ('createdAt') {
                  <a class="text-primary hover:underline" [href]="'/pagos/' + row.id"><time [attr.datetime]="row.createdAt">{{ date(row.createdAt) }}</time></a>
                }
                @case ('amountMinor') {
                  <span class="eeg-mono">{{ money(row.amountMinor, row.currency) }}</span>
                }
                @case ('status') {
                  <aula-badge [tone]="tone(row.status)">{{ t.status[statusOf(row)] }}</aula-badge>
                }
                @case ('id') {
                  <!-- [Sprint 2.6]: factura PDF de la orden pagada (o reembolsada) — dueño o ADMIN -->
                  @if (row.status !== 'pending' && row.status !== 'failed' && row.status !== 'expired') {
                    <a aulaButton variant="ghost" size="sm" download [href]="invoiceUrl(row.orderId)" [attr.aria-label]="t.invoice + ' ' + date(row.createdAt)"><aula-icon name="receipt" /> {{ t.invoice }}</a>
                  }
                  @if (isAdmin() && left(row) > 0) {
                    <button aulaButton variant="outline" size="sm" type="button" [attr.aria-label]="t.refund + ' ' + date(row.createdAt)" (click)="refundTarget.set(row)">{{ t.refund }}</button>
                  }
                }
              }
            </ng-template>
          </aula-data-table>
        }
      }
      <!-- [Mínimo privilegio]: el diálogo ni se renderiza para quien no es ADMIN -->
      @if (isAdmin()) {
        <aula-refund-dialog [open]="!!refundTarget()" [maxMinor]="refundTarget() ? left(refundTarget()!) : 0" [busy]="facade.refunding()" [texts]="refundTexts()" (confirmed)="refund($event)" (closed)="refundTarget.set(null)" />
      }
    </aula-card-page>
  `,
})
export default class PaymentsPage {
  protected readonly i18n = inject(I18nService);
  protected readonly facade = inject(PaymentsFacade);
  private readonly session = inject(SessionService);
  readonly id = input<string>(); // /pagos/:id (withComponentInputBinding)
  protected readonly refundTarget = signal<Payment | null>(null);
  private readonly api = inject(API_URL);
  protected readonly isAdmin = computed(() => this.session.hasRole('ADMIN'));
  protected readonly byId = (p: Payment) => p.id;
  protected readonly selected = computed(() => (this.id() ? (this.facade.payments.data() ?? []).find((p) => p.id === this.id()) : undefined));

  protected readonly columns = computed<DataColumn<Payment>[]>(() => {
    const t = this.i18n.t().payments;
    return [
      { key: 'createdAt', header: t.date },
      { key: 'amountMinor', header: t.amount, align: 'end' },
      { key: 'status', header: t.statusCol },
      { key: 'id', header: t.actions, align: 'end' },
    ];
  });

  // [Textos del diálogo]: `fmt` interpola moneda y máximo según el pago elegido
  protected readonly refundTexts = computed<RefundTexts>(() => {
    const t = this.i18n.t().payments;
    const p = this.refundTarget();
    const max = p ? this.money(this.left(p), p.currency) : '';
    return {
      title: t.refundTitle,
      amount: this.i18n.fmt(t.refundAmount, { currency: p?.currency ?? '' }),
      hint: this.i18n.fmt(t.refundHint, { max }),
      reason: t.refundReason,
      submit: t.refundSubmit,
      close: this.i18n.t().common.close,
      range: this.i18n.fmt(t.refundMax, { max }),
    };
  });

  constructor() {
    void this.facade.load();
  }

  protected async refund(req: RefundRequest): Promise<void> {
    const p = this.refundTarget();
    if (!p) return;
    const done = await this.facade.refund(p.id, req.amountMinor, req.reason);
    if (done) this.refundTarget.set(null);
  }

  protected left(p: Payment): number {
    return refundable(p);
  }

  // [invoiceUrl · Sprint 2.6]: GET /api/payments/orders/:id/invoice (BFF de Next.js → NestJS, PDF con Content-Disposition)
  protected invoiceUrl(orderId: string): string {
    return `${this.api}/payments/orders/${encodeURIComponent(orderId)}/invoice`;
  }

  protected statusOf(p: Payment): PaymentStatus {
    return p.status;
  }

  protected tone(s: PaymentStatus): BadgeTone {
    return STATUS_TONE[s];
  }

  protected money(minor: number, currency: string): string {
    return formatMoney(minor, currency, this.i18n.intl());
  }

  protected date(iso: string): string {
    return new Date(iso).toLocaleString(this.i18n.intl());
  }
}
