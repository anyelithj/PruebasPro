import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
// [TextInputComponent · Átomo]: campo de texto (una línea o multilínea) compatible con Signal Forms (`[formField]`) | [Patrón]: Atomic Design + Adapter (FormValueControl) | [Principio]: DRY (utilidad `control` del sistema de diseño) + ISP (solo implementa value/disabled/invalid/touched)
// [Tecnología]: Angular 22 Signal Forms — `model()` es el valor bidireccional que la directiva FormField sincroniza

@Component({
  selector: 'aula-text-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (multiline()) {
      <textarea
        class="control w-full resize-y"
        [id]="inputId()"
        [rows]="rows()"
        [value]="value()"
        [disabled]="disabled()"
        [attr.placeholder]="placeholder() || null"
        [attr.aria-invalid]="(invalid() && touched()) || null"
        [attr.aria-describedby]="describedBy() || null"
        (input)="value.set($any($event.target).value)"
        (blur)="touched.set(true)"
      ></textarea>
    } @else {
      <input
        class="control w-full"
        [id]="inputId()"
        [type]="type()"
        [value]="value()"
        [disabled]="disabled()"
        [attr.placeholder]="placeholder() || null"
        [attr.autocomplete]="autocomplete()"
        [attr.aria-invalid]="(invalid() && touched()) || null"
        [attr.aria-describedby]="describedBy() || null"
        (input)="value.set($any($event.target).value)"
        (blur)="touched.set(true)"
      />
    }
  `,
})
export class TextInputComponent implements FormValueControl<string> {
  // [Contrato FormValueControl]: `value` (model) obligatorio; disabled/invalid/touched los rellena la directiva [formField]
  readonly value = model('');
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly touched = model(false);

  readonly inputId = input.required<string>(); // Lo enlaza <label for> en aula-form-field
  readonly describedBy = input<string>(''); // id del mensaje de ayuda/error
  readonly placeholder = input('');
  readonly type = input<'text' | 'search' | 'email'>('text');
  readonly autocomplete = input('off');
  readonly multiline = input(false);
  readonly rows = input(4);
}
