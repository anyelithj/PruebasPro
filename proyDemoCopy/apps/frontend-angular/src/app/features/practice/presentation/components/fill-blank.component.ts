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
import { blanksOf } from '../../domain/models/practice';
// [FillBlankComponent · Presentacional · Sprint 8.14]: completar huecos — el enunciado con «___» se pinta con un campo en cada hueco | [Patrón]: Presentational Component | [Principio]: SRP + funciones puras del dominio (blanksOf) | [Paradigma]: Declarativo + Reactivo
// [A11y]: cada campo tiene nombre accesible («Hueco 1») y ancho según lo escrito; Tab salta de hueco en hueco · sin autocorrector (no «ayuda» con la respuesta)

@Component({
  selector: 'aula-fill-blank',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }, // Elemento anfitrión en bloque → respeta márgenes y space-y del contenedor
  template: `
    <p class="text-lg leading-[2.4] font-medium" [attr.lang]="language()">
      @for (part of parts(); track $index) {
        <span>{{ part }}</span>
        @if ($index < parts().length - 1) {
          <input
            class="control mx-1 inline-block min-h-9 w-32 px-2 py-1 text-center align-baseline"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            [attr.aria-label]="blankLabel().replace('{n}', '' + ($index + 1))"
            [value]="values()[$index] ?? ''"
            [disabled]="disabled()"
            (input)="set($index, $any($event.target).value)"
          />
        }
      }
    </p>
  `,
})
export class FillBlankComponent {
  readonly prompt = input.required<string>();
  readonly language = input('en');
  readonly disabled = input(false);
  readonly blankLabel = input('Hueco {n}');
  readonly changed = output<string[]>();
  protected readonly parts = computed(() => blanksOf(this.prompt()));
  protected readonly values = signal<string[]>([]);

  constructor() {
    effect(() => {
      const n = this.parts().length - 1; // Ítem nuevo → huecos vacíos
      untracked(() => this.values.set(Array.from({ length: n }, () => '')));
    });
  }

  protected set(i: number, v: string): void {
    this.values.update((vals) => vals.map((x, j) => (j === i ? v : x)));
    this.changed.emit(this.values().map((x) => x.trim()));
  }
}
