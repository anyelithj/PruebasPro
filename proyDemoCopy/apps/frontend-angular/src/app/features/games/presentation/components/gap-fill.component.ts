import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import type { Verdict } from '../../domain/models/games';
// [GapFillComponent · Presentacional · Sprints 8.8/8.10]: campo de respuesta corta con comprobación y feedback inmediato (dictado parcial, pregunta rápida, reformula, recuperación) | [Patrón]: Presentational Component + State Machine (respondiendo → calificado) | [Principio]: SRP + DRY | [Paradigma]: Declarativo + Reactivo
// [A11y]: etiqueta visible, Enter comprueba, veredicto con icono + texto en role="status" (no solo color), el foco vuelve al campo en cada ronda

@Component({
  selector: 'aula-gap-fill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }, // Elemento anfitrión en bloque → respeta márgenes y space-y del contenedor
  template: `
    <form class="space-y-3" (submit)="$event.preventDefault(); check()">
      <label class="block text-sm font-semibold" [attr.for]="inputId()">{{ label() }}</label>
      <div class="flex flex-wrap gap-2">
        @if (multiline()) {
          <textarea
            [id]="inputId()"
            class="control min-w-0 flex-1"
            rows="3"
            [value]="value()"
            (input)="value.set($any($event.target).value)"
            [disabled]="!!verdict()"
            [attr.lang]="language()"
          ></textarea>
        } @else {
          <input
            [id]="inputId()"
            class="control min-w-0 flex-1"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            [value]="value()"
            (input)="value.set($any($event.target).value)"
            [disabled]="!!verdict()"
            [attr.lang]="language()"
          />
        }
        @if (!verdict()) {
          <button type="submit" class="btn btn-primary" [disabled]="!value().trim() || busy()">
            {{ checkLabel() }}
          </button>
        } @else {
          <button type="button" class="btn btn-outline" (click)="next.emit()">
            {{ nextLabel() }} →
          </button>
        }
      </div>
      @if (verdict(); as v) {
        <p
          role="status"
          class="rounded-lg px-3 py-2 text-sm font-semibold"
          [class]="
            v.correct === false
              ? 'bg-tone-danger-soft text-tone-danger'
              : 'bg-tone-brand-soft text-tone-brand'
          "
        >
          {{ v.correct === false ? '✗ ' + wrongLabel() : v.correct ? '✓ ' + correctLabel() : '•' }}
          @if (v.expected && v.correct !== true) {
            <span class="block font-normal"
              >{{ expectedLabel() }} <b [attr.lang]="language()">{{ v.expected }}</b></span
            >
          }
        </p>
      }
    </form>
  `,
})
export class GapFillComponent {
  readonly label = input.required<string>();
  readonly inputId = input('gap-answer');
  readonly language = input<string | null>(null);
  readonly multiline = input(false);
  readonly busy = input(false);
  readonly verdict = input<Verdict | null>(null); // null = aún sin comprobar
  readonly roundKey = input(0); // Cambia en cada ronda → limpia el campo
  readonly checkLabel = input('Comprobar');
  readonly nextLabel = input('Siguiente');
  readonly correctLabel = input('¡Correcto!');
  readonly wrongLabel = input('No es correcto');
  readonly expectedLabel = input('Respuesta esperada:');
  readonly answered = output<string>();
  readonly next = output<void>();
  protected readonly value = signal('');

  constructor() {
    effect(() => {
      this.roundKey();
      untracked(() => this.value.set(''));
    });
  }

  protected check(): void {
    const v = this.value().trim();
    if (v && !this.verdict()) this.answered.emit(v);
  }
}
