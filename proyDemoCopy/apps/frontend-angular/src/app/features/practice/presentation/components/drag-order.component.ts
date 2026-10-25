import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import {
  CdkDrag,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
  type CdkDragDrop,
} from '@angular/cdk/drag-drop';
// [DragOrderComponent · Presentacional · Sprint 8.14]: ordenar fichas arrastrando (CDK DragDrop, lista ordenable) + botones ↑ ↓ como alternativa por teclado | [Patrón]: Presentational Component | [Principio]: SRP + accesibilidad (WCAG 2.5.7) | [Paradigma]: Declarativo + Reactivo (copia inmutable al mover)
// [A11y]: cada ficha con su número de posición en texto; los botones dicen qué mueven («Subir “goes”») y el nuevo orden se anuncia por `aria-live`

@Component({
  selector: 'aula-drag-order',
  imports: [CdkDropList, CdkDrag, CdkDragHandle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }, // Elemento anfitrión en bloque → respeta márgenes y space-y del contenedor
  template: `
    <p class="mb-2 text-sm text-muted-foreground">{{ hint() }}</p>
    <ol
      cdkDropList
      cdkDropListOrientation="vertical"
      (cdkDropListDropped)="drop($event)"
      [cdkDropListDisabled]="disabled()"
      class="space-y-2"
    >
      @for (w of order(); track w + $index; let i = $index; let last = $last) {
        <li
          cdkDrag
          class="flex items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-sm"
        >
          <span cdkDragHandle class="cursor-grab px-1 text-muted-foreground" aria-hidden="true"
            >⋮⋮</span
          >
          <span class="w-6 text-center text-xs font-bold text-muted-foreground tabular-nums">{{
            i + 1
          }}</span>
          <span class="flex-1 font-semibold" [attr.lang]="language()">{{ w }}</span>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            [disabled]="disabled() || i === 0"
            [attr.aria-label]="upLabel().replace('{w}', w)"
            (click)="move(i, i - 1)"
          >
            ↑
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            [disabled]="disabled() || last"
            [attr.aria-label]="downLabel().replace('{w}', w)"
            (click)="move(i, i + 1)"
          >
            ↓
          </button>
        </li>
      }
    </ol>
    <p class="sr-only" aria-live="polite">{{ order().join(' ') }}</p>
  `,
})
export class DragOrderComponent {
  readonly tiles = input.required<string[]>(); // Fichas en el orden en que llegan (barajadas por el docente/IA)
  readonly language = input('en');
  readonly disabled = input(false);
  readonly hint = input('');
  readonly upLabel = input('Subir «{w}»');
  readonly downLabel = input('Bajar «{w}»');
  readonly changed = output<string[]>();
  protected readonly order = signal<string[]>([]);

  constructor() {
    effect(() => {
      const t = this.tiles();
      untracked(() => {
        this.order.set([...t]);
        this.changed.emit([...t]); // El orden inicial ya es una respuesta (se puede enviar sin mover)
      });
    });
  }

  protected drop(e: CdkDragDrop<string[]>): void {
    this.move(e.previousIndex, e.currentIndex);
  }

  // [move]: `moveItemInArray` (CDK) sobre una copia → signal inmutable
  protected move(from: number, to: number): void {
    const next = [...this.order()];
    moveItemInArray(next, from, to);
    this.order.set(next);
    this.changed.emit(next);
  }
}
