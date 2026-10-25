import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, signal, viewChild } from '@angular/core';
import { FormField, form, max, maxLength, min, submit } from '@angular/forms/signals';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { FormFieldComponent } from '@shared/ui/molecules/form-field/form-field.component';
// [RefundDialogComponent · Presentacional]: diálogo de reembolso total o parcial (solo lo muestra la página a un ADMIN) | [Patrón]: Presentational Component (input()/output()) + Modal nativo | [Principio]: SRP + Fail Fast (validación antes de llamar al backend) | [Paradigma]: Declarativo + Reactivo (Signal Forms)
// [A11y]: <dialog> nativo con `showModal()` → foco atrapado, Escape cierra y el fondo queda inerte sin JS extra · errores asociados por aria-describedby
// [Tecnología]: Angular 22 Signal Forms (`form`, `min`, `max`, `submit`)

export interface RefundRequest {
  amountMinor?: number; // undefined = todo lo que queda
  reason?: string;
}

export interface RefundTexts {
  title: string;
  amount: string;
  hint: string;
  reason: string;
  submit: string;
  close: string;
  range: string;
}

@Component({
  selector: 'aula-refund-dialog',
  imports: [FormField, FormFieldComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = texts();
    <dialog #dlg class="w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-slate-900/50" aria-labelledby="refund-title" (close)="closed.emit()">
      <form class="space-y-4 p-5" (submit)="onSubmit($event)" novalidate>
        <h2 id="refund-title" class="text-lg font-bold">{{ tx.title }}</h2>
        <aula-form-field fieldId="refund-amount" [label]="tx.amount" [hint]="tx.hint" [error]="amountError()">
          <input id="refund-amount" type="number" inputmode="decimal" step="0.01" class="control w-full" [formField]="f.amount" [attr.aria-describedby]="amountError() ? 'refund-amount-error' : 'refund-amount-hint'" />
        </aula-form-field>
        <aula-form-field fieldId="refund-reason" [label]="tx.reason">
          <input id="refund-reason" type="text" class="control w-full" [formField]="f.reason" />
        </aula-form-field>
        <div class="flex justify-end gap-2">
          <button aulaButton variant="ghost" size="sm" type="button" (click)="dlg.close()">{{ tx.close }}</button>
          <button aulaButton variant="danger" size="sm" type="submit" [loading]="busy()">{{ tx.submit }}</button>
        </div>
      </form>
    </dialog>
  `,
})
export class RefundDialogComponent {
  readonly open = input(false);
  readonly maxMinor = input.required<number>(); // Lo que queda por reembolsar
  readonly busy = input(false);
  readonly texts = input.required<RefundTexts>();
  readonly confirmed = output<RefundRequest>();
  readonly closed = output<void>();
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  // [Signal Forms]: modelo como signal; monto en unidades mayores (19.99) y `null` = vacío
  protected readonly model = signal<{ amount: number | null; reason: string }>({ amount: null, reason: '' });
  protected readonly f = form(this.model, (p) => {
    min(p.amount, 0.01, { message: () => this.texts().range });
    max(p.amount, () => this.maxMinor() / 100, { message: () => this.texts().range });
    maxLength(p.reason, 300);
  });
  protected readonly amountError = () => {
    const s = this.f.amount();
    return s.touched() && s.invalid() ? (s.errors()[0]?.message ?? this.texts().range) : '';
  };

  constructor() {
    // `effect`: el input `open` del padre controla el modal nativo (showModal / close)
    effect(() => {
      const d = this.dlg().nativeElement;
      if (this.open() && !d.open) {
        this.model.set({ amount: null, reason: '' });
        d.showModal();
      } else if (!this.open() && d.open) d.close();
    });
  }

  // `submit` (Signal Forms): marca todo como tocado y solo emite si es válido | centavos con Math.round (sin coma flotante)
  protected onSubmit(e: Event): void {
    e.preventDefault();
    void submit(this.f, async () => {
      const { amount, reason } = this.model();
      this.confirmed.emit({ amountMinor: amount ? Math.round(amount * 100) : undefined, reason: reason.trim() || undefined });
    });
  }
}
