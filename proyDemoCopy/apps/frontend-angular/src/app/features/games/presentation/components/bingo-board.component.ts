import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { VocabItem } from '../../domain/models/games';
// [BingoBoardComponent · Presentacional · Sprint 8.8]: tablero de palabras — escuchar la palabra y localizarla | [Patrón]: Presentational Component | [Principio]: SRP (qué palabra suena y si acertó lo decide la página) | [Paradigma]: Declarativo
// [A11y]: casillas = <button> con la palabra; marcadas con ✓ en texto y `aria-pressed` · grilla responsive 2→3→4 columnas

@Component({
  selector: 'aula-bingo-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }, // Elemento anfitrión en bloque → respeta márgenes y space-y del contenedor
  template: `
    <div
      class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
      role="group"
      [attr.aria-label]="label()"
    >
      @for (it of items(); track $index) {
        @let done = marked().includes($index);
        <button
          type="button"
          class="min-h-16 rounded-xl border-2 px-3 py-2 text-base font-bold transition-colors"
          [class]="
            done
              ? 'border-transparent bg-tone-brand-soft text-tone-brand'
              : 'border-border bg-card hover:border-primary'
          "
          [attr.aria-pressed]="done"
          [disabled]="done || disabled()"
          [attr.lang]="language()"
          (click)="pick.emit($index)"
        >
          @if (done) {
            <span aria-hidden="true">✓ </span>
          }
          {{ it.term }}
        </button>
      }
    </div>
  `,
})
export class BingoBoardComponent {
  readonly items = input.required<VocabItem[]>();
  readonly marked = input<number[]>([]);
  readonly disabled = input(false);
  readonly language = input('en');
  readonly label = input('Tablero');
  readonly pick = output<number>();
}
