import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { WordStatus } from '@core/dictionary/dictionary.model';
// [WordTokenComponent · Molécula · Sprint 10.3 · RF-136/RF-137]: una palabra pulsable dentro de un texto — botón nativo (clic, dedo, Enter y Espacio) que se resalta si se está aprendiendo o ya se aprendió | [Patrón]: Atomic Design (molécula) + Presentational Component | [Principio]: SRP + accesibilidad (el estado se dice en el nombre accesible, no solo con color: WCAG 1.4.1) | [Paradigma]: Declarativo
// [Diseño]: subrayado punteado morado = aprendiendo · subrayado verde = aprendida · sin marca = texto normal con hover lavanda (no distrae la lectura)

@Component({
  selector: 'aula-word-token',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <button
      type="button"
      data-word
      [tabIndex]="first() ? 0 : -1"
      [attr.lang]="language()"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-expanded]="open()"
      aria-haspopup="dialog"
      [class]="cls()"
      (click)="picked.emit($event.currentTarget)"
    >
      {{ text() }}
    </button>
  `,
})
export class WordTokenComponent {
  readonly text = input.required<string>();
  readonly language = input('en');
  readonly status = input<WordStatus | null>(null);
  readonly first = input(false); // La primera palabra recibe la parada de tabulación (WordLookupDirective la mueve después)
  readonly open = input(false); // ¿Su ventana está abierta?
  readonly label = input('{w}'); // Plantilla del nombre accesible («Diccionario: «{w}»»)
  readonly statusLabel = input(''); // «Aprendiendo» / «Aprendido» (se suma al nombre accesible)
  readonly picked = output<EventTarget | null>();

  protected readonly ariaLabel = computed(() => {
    const base = this.label().replace('{w}', this.text());
    return this.statusLabel() ? `${base} · ${this.statusLabel()}` : base;
  });

  protected readonly cls = computed(() => {
    const base =
      'inline rounded-sm px-0.5 align-baseline transition-colors hover:bg-tone-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
    const s = this.status();
    if (s === 'learning')
      return `${base} bg-tone-brand-soft/60 underline decoration-primary decoration-dotted decoration-2 underline-offset-4`;
    if (s === 'learned') return `${base} underline decoration-tone-info decoration-2 underline-offset-4`;
    return this.open() ? `${base} bg-tone-brand-soft` : base;
  });
}
