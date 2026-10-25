import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import type { FluencyMetric } from '../../domain/models/games';
import { MetricCardComponent } from './metric-card.component';
// [OralRoundResultComponent · Presentacional · Sprint 8.9/8.11]: lo que entendió faster-whisper + métricas de fluidez de la ronda oral (tema al azar, hablar contra reloj) | [Patrón]: Presentational Component (compone MetricCard) | [Principio]: DRY + SRP | [Paradigma]: Declarativo
// [A11y]: región `role="status"` → se anuncia al llegar el resultado · cifras con unidad en texto

@Component({
  selector: 'aula-oral-round-result',
  imports: [MetricCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }, // Elemento anfitrión en bloque → respeta márgenes y space-y del contenedor
  template: `
    @let tx = i18n.t().games;
    <section role="status" class="space-y-3">
      @if (text()) {
        <p class="rounded-xl bg-muted px-3 py-2 text-sm">
          <b>{{ tx.youSaid }}:</b> «<span [attr.lang]="language()">{{ text() }}</span
          >»
        </p>
      }
      @if (metric(); as m) {
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <aula-metric-card [label]="tx.wpm" [value]="round(m.wordsPerMinute)" />
          <aula-metric-card [label]="tx.wordsProduced" [value]="m.wordsProduced" />
          <aula-metric-card
            [label]="tx.pauses"
            [value]="m.pauses"
            [hint]="tx.longestRun + ': ' + i18n.fmt(tx.seconds, { n: round(m.longestRunS) })"
          />
          <aula-metric-card [label]="tx.reuse" [value]="round(m.reuseRatio * 100) + ' %'" />
        </div>
      }
    </section>
  `,
})
export class OralRoundResultComponent {
  protected readonly i18n = inject(I18nService);
  readonly text = input('');
  readonly language = input('en');
  readonly metric = input<FluencyMetric | null>(null);
  protected round(n: number): number {
    return Math.round(n * 10) / 10; // Un decimal
  }
}
