import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { formatMoney } from '../../domain/models/payments';
// [OrderSummaryComponent · Presentacional]: ítems de la orden y total — lo que el usuario va a pagar | [Patrón]: Presentational Component (solo input()) | [Principio]: SRP + DRY (formatMoney del dominio) | [Paradigma]: Declarativo
// [A11y]: lista de definiciones (<dl>) → los lectores anuncian «curso: precio» · total con <output> (anunciado al cambiar)

export interface SummaryLine {
  id: string;
  title: string;
  amountMinor: number;
}

@Component({
  selector: 'aula-order-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section [attr.aria-labelledby]="headingId" class="space-y-3">
      <h2 [id]="headingId" class="text-lg font-bold">{{ heading() }}</h2>
      <dl class="divide-y divide-border rounded-xl border border-border">
        @for (line of lines(); track line.id) {
          <div class="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <dt class="min-w-0 truncate font-medium">{{ line.title }}</dt>
            <dd class="eeg-mono shrink-0">{{ money(line.amountMinor) }}</dd>
          </div>
        }
        <div class="flex items-center justify-between gap-3 bg-muted/50 px-4 py-3">
          <dt class="font-bold">{{ totalLabel() }}</dt>
          <dd><output class="eeg-mono text-base font-extrabold">{{ money(totalMinor()) }}</output></dd>
        </div>
      </dl>
    </section>
  `,
})
export class OrderSummaryComponent {
  readonly heading = input.required<string>();
  readonly totalLabel = input.required<string>();
  readonly lines = input.required<readonly SummaryLine[]>();
  readonly totalMinor = input.required<number>();
  readonly currency = input.required<string>();
  readonly locale = input('es-CO');
  protected readonly headingId = 'order-summary-title';

  protected money(minor: number): string {
    return formatMoney(minor, this.currency(), this.locale());
  }
}
