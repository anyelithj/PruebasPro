import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { words } from '../../domain/models/practice';
// [MarkErrorsComponent · Presentacional · Sprint 8.14]: marcador — cada palabra del texto es un botón que se marca como error (o se desmarca) | [Patrón]: Presentational Component + Toggle | [Principio]: SRP + funciones puras del dominio (words) | [Paradigma]: Declarativo + Reactivo
// [A11y]: `aria-pressed` en cada palabra, marcada = subrayado ondulado + fondo + ✗ (no solo color), contador de marcadas en `aria-live` · [Contrato]: answer = índices de palabra marcados

@Component({
  selector: 'aula-mark-errors',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }, // Elemento anfitrión en bloque → respeta márgenes y space-y del contenedor
  template: `
    <p class="mb-2 text-sm text-muted-foreground">{{ hint() }}</p>
    <p class="flex flex-wrap gap-1 text-lg leading-relaxed" [attr.lang]="language()">
      @for (w of list(); track $index) {
        @let on = marked().has($index);
        <button
          type="button"
          class="rounded-md px-1.5 py-0.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          [class]="
            on
              ? 'bg-tone-danger-soft text-tone-danger underline decoration-wavy decoration-2 underline-offset-4'
              : 'hover:bg-muted'
          "
          [attr.aria-pressed]="on"
          [disabled]="disabled()"
          (click)="toggle($index)"
        >
          @if (on) {
            <span aria-hidden="true">✗</span>
          }
          {{ w }}
        </button>
      }
    </p>
    <p class="mt-2 text-xs text-muted-foreground" aria-live="polite">
      {{ countLabel().replace('{n}', '' + marked().size) }}
    </p>
  `,
})
export class MarkErrorsComponent {
  readonly text = input.required<string>();
  readonly language = input('en');
  readonly disabled = input(false);
  readonly hint = input('');
  readonly countLabel = input('{n}');
  readonly changed = output<string[]>();
  protected readonly list = computed(() => words(this.text()));
  protected readonly marked = signal(new Set<number>());

  constructor() {
    effect(() => {
      this.text();
      untracked(() => this.marked.set(new Set()));
    });
  }

  protected toggle(i: number): void {
    this.marked.update((m) => {
      const next = new Set(m);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
    this.changed.emit([...this.marked()].sort((a, b) => a - b).map(String)); // Índices como texto (contrato string[])
  }
}
