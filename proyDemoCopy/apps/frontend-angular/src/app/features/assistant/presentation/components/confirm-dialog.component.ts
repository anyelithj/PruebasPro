import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
// [ConfirmDialogComponent · Presentación · 2026-10-28]: confirmación de borrado (conversación o mensaje) SIN `window.confirm` | [Patrón]: Presentational Component (input()/output()) + Modal nativo | [Principio]: SRP + DRY (un solo diálogo para los dos borrados) | [Paradigma]: Declarativo + Reactivo (effect)
// [A11y]: <dialog> con `showModal()` → foco atrapado y fondo inerte · role="alertdialog" + aria-labelledby/aria-describedby · el foco inicial va a «Cancelar» (acción segura) · Escape cancela

let nextId = 0;

@Component({
  selector: 'aula-confirm-dialog',
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dlg
      role="alertdialog"
      class="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-slate-900/50"
      [attr.aria-labelledby]="ids.title"
      [attr.aria-describedby]="ids.body"
      (close)="closed.emit()"
    >
      <div class="space-y-4 p-5">
        <h2 [id]="ids.title" class="title-section">{{ title() }}</h2>
        <p [id]="ids.body" class="text-muted-foreground">{{ body() }}</p>
        <div class="flex justify-end gap-2">
          <button #cancelBtn aulaButton variant="ghost" size="sm" type="button" (click)="dlg.close()">{{ cancelLabel() }}</button>
          <button aulaButton variant="danger" size="sm" type="button" [loading]="busy()" (click)="confirmed.emit()">{{ confirmLabel() }}</button>
        </div>
      </div>
    </dialog>
  `,
})
export class ConfirmDialogComponent {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly body = input.required<string>();
  readonly confirmLabel = input.required<string>();
  readonly cancelLabel = input.required<string>();
  readonly busy = input(false);
  readonly confirmed = output<void>();
  readonly closed = output<void>(); // Escape, «Cancelar» o cierre tras confirmar
  protected readonly ids = { title: `aula-confirm-title-${++nextId}`, body: `aula-confirm-body-${nextId}` };
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  private readonly cancelBtn = viewChild.required('cancelBtn', { read: ElementRef<HTMLButtonElement> }); // `read: ElementRef`: la referencia está sobre un componente (aulaButton)

  constructor() {
    // `effect`: el input `open` del padre controla el modal nativo (showModal / close)
    effect(() => {
      const d = this.dlg().nativeElement;
      if (this.open() && !d.open) {
        d.showModal();
        this.cancelBtn().nativeElement.focus(); // Foco en la acción segura
      } else if (!this.open() && d.open) d.close();
    });
  }
}
