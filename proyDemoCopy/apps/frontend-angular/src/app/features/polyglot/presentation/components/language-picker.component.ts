import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CdkDrag, CdkDragHandle, CdkDropList, type CdkDragDrop } from '@angular/cdk/drag-drop';
import type { Language } from '@aula/shared-schemas';
import { DEFAULT_ORDER } from '../../domain/language-order';
// [LanguagePickerComponent · Presentacional · Sprint 10.7 · RF-129/RF-131]: elegir qué idiomas ver (casillas) y su orden (CDK DragDrop horizontal o botones ↑ ↓ como alternativa por teclado) | [Patrón]: Presentational Component | [Principio]: SRP + accesibilidad (WCAG 2.5.7: arrastrar nunca es la única forma) | [Paradigma]: Declarativo
// [A11y]: el orden resultante se anuncia por `aria-live` · los botones dicen qué mueven («Subir Inglés»)

@Component({
  selector: 'aula-language-picker',
  imports: [CdkDropList, CdkDrag, CdkDragHandle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="space-y-3">
      <legend class="text-sm font-bold">{{ legend() }}</legend>
      <p class="text-xs text-muted-foreground">{{ hint() }}</p>
      <div class="flex flex-wrap gap-2">
        @for (l of all; track l) {
          <label
            class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-tone-brand-soft"
          >
            <input
              type="checkbox"
              class="size-4 accent-[var(--primary)]"
              [checked]="order().includes(l)"
              [disabled]="order().length === 1 && order().includes(l)"
              (change)="toggled.emit(l)"
            />
            {{ names()[l] ?? l }}
          </label>
        }
      </div>
      <ol
        cdkDropList
        cdkDropListOrientation="mixed"
        (cdkDropListDropped)="drop($event)"
        class="flex flex-wrap gap-2"
        [attr.aria-label]="legend()"
      >
        @for (l of order(); track l; let i = $index; let last = $last) {
          <li
            cdkDrag
            class="flex items-center gap-1 rounded-full border border-tone-brand-line bg-tone-brand-soft py-1 pl-2 pr-1 text-sm font-semibold text-tone-brand shadow-sm"
          >
            <span cdkDragHandle class="cursor-grab px-1" aria-hidden="true">⋮⋮</span>
            <span class="tabular-nums text-xs opacity-70">{{ i + 1 }}.</span>
            {{ names()[l] ?? l }}
            <button
              type="button"
              class="grid size-8 place-items-center rounded-full hover:bg-card disabled:opacity-40"
              [disabled]="i === 0"
              [attr.aria-label]="upLabel().replace('{l}', names()[l] ?? l)"
              (click)="moved.emit({ lang: l, delta: -1 })"
            >
              ↑
            </button>
            <button
              type="button"
              class="grid size-8 place-items-center rounded-full hover:bg-card disabled:opacity-40"
              [disabled]="last"
              [attr.aria-label]="downLabel().replace('{l}', names()[l] ?? l)"
              (click)="moved.emit({ lang: l, delta: 1 })"
            >
              ↓
            </button>
          </li>
        }
      </ol>
      <p class="sr-only" aria-live="polite">{{ spoken() }}</p>
      <button type="button" class="btn btn-ghost btn-sm" (click)="restored.emit()">↺ {{ restoreLabel() }}</button>
    </fieldset>
  `,
})
export class LanguagePickerComponent {
  protected readonly all = DEFAULT_ORDER;
  readonly order = input.required<Language[]>();
  readonly names = input<Record<string, string>>({});
  readonly legend = input('Idiomas');
  readonly hint = input('');
  readonly upLabel = input('Subir {l}');
  readonly downLabel = input('Bajar {l}');
  readonly restoreLabel = input('Orden por defecto');
  readonly toggled = output<Language>();
  readonly moved = output<{ lang: Language; delta: -1 | 1 }>();
  readonly dropped = output<{ from: number; to: number }>();
  readonly restored = output<void>();

  protected drop(e: CdkDragDrop<Language[]>): void {
    if (e.previousIndex !== e.currentIndex) this.dropped.emit({ from: e.previousIndex, to: e.currentIndex });
  }

  protected spoken(): string {
    return this.order()
      .map((l) => this.names()[l] ?? l)
      .join(', ');
  }
}
