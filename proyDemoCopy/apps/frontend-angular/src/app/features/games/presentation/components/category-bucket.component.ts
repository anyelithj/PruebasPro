import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CdkDropList, type CdkDragDrop } from '@angular/cdk/drag-drop';
// [CategoryBucketComponent · Presentacional · Sprint 8.8]: grupo de destino de «clasificación rápida» con CDK DragDrop + alternativa por teclado (botón «a este grupo») | [Patrón]: Presentational Component + Observer (`dropped`) | [Principio]: SRP + accesibilidad primero (WCAG 2.5.7: arrastrar NUNCA es la única forma) | [Paradigma]: Declarativo
// [Tecnología]: @angular/cdk/drag-drop (`cdkDropList` conectado por id con la lista de palabras de la página)

@Component({
  selector: 'aula-category-bucket',
  imports: [CdkDropList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section
      cdkDropList
      [id]="listId()"
      [cdkDropListData]="name()"
      (cdkDropListDropped)="onDrop($event)"
      class="flex min-h-36 flex-col gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/40 p-3 transition-colors [&.cdk-drop-list-receiving]:border-primary [&.cdk-drop-list-receiving]:bg-tone-brand-soft"
      [attr.aria-label]="name()"
    >
      <header class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-extrabold uppercase tracking-wide" [attr.lang]="language()">
          {{ name() }}
        </h3>
        <!-- [Teclado]: con una palabra elegida, este botón la envía aquí (sin arrastrar) -->
        @if (selected()) {
          <button type="button" class="btn btn-outline btn-sm" (click)="chosen.emit(name())">
            → {{ name() }}
          </button>
        }
      </header>
      <ul class="flex flex-wrap gap-1.5">
        @for (w of placed(); track w.term) {
          <li
            class="badge text-xs"
            [class]="
              w.ok ? 'bg-tone-brand-soft text-tone-brand' : 'bg-tone-danger-soft text-tone-danger'
            "
            [attr.lang]="language()"
          >
            {{ w.ok ? '✓' : '✗' }} {{ w.term }}
          </li>
        }
      </ul>
      <p class="mt-auto text-center text-xs text-muted-foreground" aria-hidden="true">
        {{ dropLabel() }}
      </p>
    </section>
  `,
})
export class CategoryBucketComponent {
  readonly name = input.required<string>(); // Categoría (en el idioma que se estudia)
  readonly listId = input.required<string>();
  readonly placed = input<{ term: string; ok: boolean }[]>([]);
  readonly selected = input(false); // Hay una palabra elegida con el teclado
  readonly language = input('en');
  readonly dropLabel = input('Suelta aquí');
  readonly dropped = output<{ index: number; category: string }>(); // `index` = palabra arrastrada (cdkDragData)
  readonly chosen = output<string>();

  protected onDrop(e: CdkDragDrop<string, unknown, number>): void {
    this.dropped.emit({ index: e.item.data, category: this.name() });
  }
}
