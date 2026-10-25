import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { ErrorFinding, TextSegment } from '../../domain/models/own-llm';
// [MarkedTextComponent · Presentación]: texto original con los errores marcados — subrayado + icono + texto oculto para lector (no solo color, WCAG 1.4.1) y navegable con teclado | [Patrón]: Presentational Component (input/output, sin servicios) | [Principio]: SRP | [Paradigma]: Declarativo
// [A11y]: cada marca es un <button> (Tab/Enter/Espacio gratis) con aria-label «error de X: original → corrección»; `selected` resalta el hallazgo en la lista

@Component({
  selector: 'aula-marked-text',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="whitespace-pre-wrap rounded-xl border border-border bg-background p-4 leading-8">
      @for (seg of segments(); track $index) {
        @if (seg.finding === null) {
          {{ seg.text }}
        } @else {
          <button
            type="button"
            class="rounded px-0.5 underline decoration-wavy decoration-2 underline-offset-4 decoration-tone-danger hover:bg-tone-danger-soft focus-visible:bg-tone-danger-soft"
            [class.bg-tone-danger-soft]="selected() === seg.finding"
            [attr.aria-pressed]="selected() === seg.finding"
            [attr.aria-label]="labelFor(seg)"
            (click)="pick.emit(seg.finding)"
          >
            <aula-icon name="triangle-alert" /> {{ seg.text }}
          </button>
        }
      }
    </p>
  `,
})
export class MarkedTextComponent {
  readonly segments = input.required<TextSegment[]>();
  readonly findings = input.required<readonly ErrorFinding[]>();
  readonly typeLabels = input.required<Record<string, string>>();
  readonly selected = input<number | null>(null);
  // `output` (Angular): evento hacia el contenedor → índice del hallazgo elegido
  readonly pick = output<number>();

  protected labelFor(seg: TextSegment): string {
    const f = this.findings()[seg.finding ?? -1];
    return f ? `${this.typeLabels()[f.type] ?? f.type}: «${f.original}» → «${f.correction}»` : seg.text;
  }
}
