import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import { markWhy, RIGHT_CLS, WRONG_CLS } from '@shared/ui/organisms/synced-transcript/transcript-line.model';
import type { SentenceCorrection } from '../../domain/models/own-llm';
// [CorrectionErrorsComponent · Molécula · 2026-11-13 · Anexo A]: lista de errores del corrector único → categoría, «original → sugerencia» y explicación en español
// La usan el feedback del turno (Diálogos) y la revisión previa al envío → un solo componente | [Patrón]: Presentational | [Principio]: DRY + SRP
// [A11y]: lista semántica, `lang` del idioma estudiado en los fragmentos y `lang="es"` en la explicación (pronunciación correcta del lector de pantalla)

@Component({
  selector: 'aula-correction-errors',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let labels = i18n.t().ownLlm.annex;
    <ul class="space-y-1">
      @for (e of errors(); track $index) {
        <li>
          <span class="type-meta mr-1 rounded bg-muted px-1.5 py-0.5 font-semibold">{{ labels[e.categoria] }}</span>
          <span [attr.lang]="language()"><span [class]="wrong">{{ e.original }}</span> → <span [class]="right">{{ e.sugerencia || '∅' }}</span></span>
          <span lang="es"> · @for (p of why(e.explicacion); track $index) {<span [class]="p.cls">{{ p.text }}</span>}</span>
        </li>
      }
    </ul>
  `,
})
export class CorrectionErrorsComponent {
  protected readonly i18n = inject(I18nService);
  readonly errors = input.required<SentenceCorrection['errores']>(); // `input.required` (Angular 17.1+): signal de entrada obligatoria
  readonly language = input('en'); // Idioma estudiado (atributo `lang`)
  protected readonly why = markWhy; // Resalta «X» en rojo/verde dentro de la explicación
  protected readonly wrong = WRONG_CLS;
  protected readonly right = RIGHT_CLS;
}
