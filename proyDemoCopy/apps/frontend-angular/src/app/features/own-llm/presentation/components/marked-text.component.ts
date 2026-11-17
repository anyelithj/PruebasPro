import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { ErrorFinding, ErrorType, TextSegment } from '../../domain/models/own-llm';
// [MarkedTextComponent · Presentación]: texto con los errores subrayados en línea — color + estilo de subrayado por tipo (no solo color, WCAG 1.4.1) y navegable con teclado | [Patrón]: Presentational Component (input/output, sin servicios) | [Principio]: SRP | [Paradigma]: Declarativo
// [A11y]: cada marca es un <button> (Tab/Enter/Espacio gratis) con aria-label «Tipo: «original» → «corrección»»; `selected` resalta la marca activa
// [2026-10-27 · Estilo GrammarMama]: ortografía roja ondulada, gramática ámbar ondulada, puntuación azul doble, vocabulario/orden de marca discontinuo, estilo gris punteado · `title` = sugerencia al pasar el ratón

// [ERROR_TONE]: clases COMPLETAS por tipo (Tailwind solo genera clases que ve literales en el código) | [Patrón]: Lookup Table | `satisfies` (TS 4.9): exige las 6 claves sin ensanchar el tipo
// [Fix 2026-10-28 · «Original (errores resaltados)»]: cada error lleva fondo suave SIEMPRE (resaltado, como GrammarMama) además del subrayado por tipo
// + «Mayúsculas» (capitalization) con subrayado continuo azul (distinto del doble de puntuación → no solo color)
export const ERROR_TONE = {
  spelling: { mark: 'bg-tone-danger-soft decoration-tone-danger decoration-wavy', active: 'ring-2 ring-tone-danger', dot: 'bg-tone-danger' },
  capitalization: { mark: 'bg-tone-info-soft decoration-tone-info decoration-solid', active: 'ring-2 ring-tone-info', dot: 'bg-tone-info' },
  grammar: { mark: 'bg-tone-warning-soft decoration-tone-warning decoration-wavy', active: 'ring-2 ring-tone-warning', dot: 'bg-tone-warning' },
  punctuation: { mark: 'bg-tone-info-soft decoration-tone-info decoration-double', active: 'ring-2 ring-tone-info', dot: 'bg-tone-info' },
  vocabulary: { mark: 'bg-tone-brand-soft decoration-tone-brand decoration-dashed', active: 'ring-2 ring-tone-brand', dot: 'bg-tone-brand' },
  word_order: { mark: 'bg-tone-brand-soft decoration-tone-brand decoration-dashed', active: 'ring-2 ring-tone-brand', dot: 'bg-tone-brand' },
  article: { mark: 'bg-tone-warning-soft decoration-tone-warning decoration-dashed', active: 'ring-2 ring-tone-warning', dot: 'bg-tone-warning' },
  style: { mark: 'bg-muted decoration-muted-foreground decoration-dotted', active: 'ring-2 ring-muted-foreground', dot: 'bg-muted-foreground' },
  // [2026-11-13 · Anexo A]: posible error de dictado → subrayado punteado neutro (no es una falta del estudiante)
  transcription: { mark: 'bg-muted decoration-tone-info decoration-dotted', active: 'ring-2 ring-tone-info', dot: 'bg-tone-info' },
} as const satisfies Record<ErrorType, { mark: string; active: string; dot: string }>;

@Component({
  selector: 'aula-marked-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <p class="whitespace-pre-wrap break-words p-3 leading-8" [attr.lang]="lang()">
      @for (seg of segments(); track $index) {
        @if (seg.finding === null) {
          {{ seg.text }}
        } @else {
          @let f = findings()[seg.finding];
          <!-- [2026-10-28]: \`[class]\` (Angular) se fusiona con el \`class\` estático → tono del tipo + anillo y negrita si es la marca activa -->
          <button
            type="button"
            class="rounded-sm px-0.5 underline decoration-2 underline-offset-4 transition-colors focus-visible:outline-2 focus-visible:outline-ring"
            [class]="toneOf(f).mark + (selected() === seg.finding ? ' font-semibold ' + toneOf(f).active : '')"
            [attr.data-type]="f?.type"
            [attr.aria-pressed]="selected() === seg.finding"
            [attr.aria-label]="labelFor(seg)"
            [title]="labelFor(seg)"
            (click)="pick.emit(seg.finding)"
          >{{ seg.text }}</button>
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
  readonly lang = input<string | null>(null); // Idioma del texto (lectores de pantalla y separación silábica)
  // `output` (Angular): evento hacia el contenedor → índice del hallazgo elegido
  readonly pick = output<number>();

  protected toneOf(f: ErrorFinding | undefined) {
    return ERROR_TONE[f?.type ?? 'grammar'];
  }

  protected labelFor(seg: TextSegment): string {
    const f = this.findings()[seg.finding ?? -1];
    return f ? `${this.typeLabels()[f.type] ?? f.type}: «${f.original}» → «${f.correction}»` : seg.text;
  }
}
