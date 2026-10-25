import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
// [AiDraftDialogComponent · Organismo · Sprint 8.15]: diálogo modal para pedir un borrador a la IA y revisarlo antes de usarlo (práctica, poliglota y gramática) | [Patrón]: Atomic Design (organismo) + Content Projection (el formulario y la vista previa los aporta cada funcionalidad) | [Principio]: SRP + DRY + OCP | [Paradigma]: Declarativo
// [Tecnología]: <dialog> nativo con `showModal()` → foco atrapado, Esc cierra y fondo inerte sin librería · [A11y]: `aria-labelledby` al título, aviso permanente «el borrador exige revisión»

@Component({
  selector: 'aula-ai-draft-dialog',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dlg
      class="m-auto w-[min(42rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm"
      aria-labelledby="ai-draft-title"
      (close)="closed.emit()"
    >
      <div class="space-y-4 p-5">
        <header class="flex items-start justify-between gap-3">
          <div>
            <h2 id="ai-draft-title" class="text-lg font-extrabold">
              <aula-icon name="sparkles" /> {{ title() }}
            </h2>
            <p class="mt-1 text-sm text-muted-foreground">{{ hint() }}</p>
          </div>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            [attr.aria-label]="closeLabel()"
            (click)="dlg.close()"
          >
            ✕
          </button>
        </header>
        <ng-content />
      </div>
    </dialog>
  `,
})
export class AiDraftDialogComponent {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly hint = input('');
  readonly closeLabel = input('Cerrar');
  readonly closed = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  constructor() {
    // `effect`: `open` controla el diálogo nativo (showModal/close) → el padre maneja un solo booleano
    effect(() => {
      const d = this.dialog().nativeElement;
      if (this.open() && !d.open) d.showModal?.();
      if (!this.open() && d.open) d.close();
    });
  }
}
