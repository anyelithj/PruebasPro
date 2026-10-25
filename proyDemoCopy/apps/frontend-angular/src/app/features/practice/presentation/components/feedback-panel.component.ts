import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import type { Feedback } from '../../domain/models/practice';
import { CorrectionDiffComponent } from './correction-diff.component';
import { ErrorBadgeComponent } from './error-badge.component';
import { TipCardComponent } from './tip-card.component';
// [FeedbackPanelComponent · Presentacional · Sprint 8.14]: panel DEBAJO del ejercicio — resultado, errores en rojo con icono y texto, corrección, respuesta correcta, explicación y consejo (RF-112, RF-113) | [Patrón]: Composite (ErrorBadge + CorrectionDiff + TipCard) | [Principio]: SRP + DRY | [Paradigma]: Declarativo
// [A11y]: `role="status"` + `aria-live="polite"` → se anuncia al llegar la corrección; el resultado se dice en texto (✓/✗ + palabra), nunca solo con color

@Component({
  selector: 'aula-feedback-panel',
  imports: [ErrorBadgeComponent, CorrectionDiffComponent, TipCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }, // Elemento anfitrión en bloque → respeta márgenes y space-y del contenedor
  template: `
    @let tx = i18n.t().practice;
    @let f = feedback();
    <section
      role="status"
      aria-live="polite"
      class="space-y-3 rounded-2xl border-2 p-4"
      [class]="
        f.correct ? 'border-tone-brand-line bg-tone-brand-soft' : 'border-tone-danger-line bg-card'
      "
    >
      <header class="flex flex-wrap items-center justify-between gap-2">
        <p
          class="text-base font-extrabold"
          [class]="f.correct ? 'text-tone-brand' : 'text-tone-danger'"
        >
          {{
            f.correct
              ? '✓ ' + tx.correct
              : f.score > 0
                ? '◐ ' + i18n.fmt(tx.partial, { pct: pct() })
                : '✗ ' + tx.wrong
          }}
        </p>
        <span class="text-xs text-muted-foreground">{{ methodLabel() }}</span>
      </header>

      @if (f.findings.length) {
        <div>
          <h3 class="mb-1 text-sm font-bold">{{ tx.corrections }}</h3>
          <ul class="space-y-2">
            @for (e of f.findings; track $index) {
              <li
                class="flex flex-col gap-1 rounded-lg bg-card p-2 sm:flex-row sm:items-start sm:gap-3"
              >
                <aula-error-badge [type]="e.type" [label]="typeLabel(e.type)" />
                <div class="min-w-0 text-sm">
                  <aula-correction-diff
                    [original]="e.original"
                    [correction]="e.correction"
                    [language]="language()"
                  />
                  <p class="mt-0.5 text-muted-foreground" lang="es">{{ e.explanation_es }}</p>
                </div>
              </li>
            }
          </ul>
        </div>
      }

      @if (!f.correct && f.correct_answer) {
        <p class="text-sm">
          <b>{{ tx.correctAnswer }}: </b>
          <span [attr.lang]="language()" class="font-semibold">{{ f.correct_answer }}</span>
        </p>
      }
      @if (f.explanation) {
        <p class="text-sm">
          <b>{{ tx.why }}: </b><span lang="es">{{ f.explanation }}</span>
        </p>
      }
      @if (f.tip) {
        <aula-tip-card [title]="tx.tip" [text]="f.tip" />
      }
    </section>
  `,
})
export class FeedbackPanelComponent {
  protected readonly i18n = inject(I18nService);
  readonly feedback = input.required<Feedback>();
  readonly language = input('en');
  protected readonly pct = computed(() => Math.round(this.feedback().score * 100));
  protected readonly methodLabel = computed(
    () => (this.i18n.t().practice.method as Record<string, string>)[this.feedback().method] ?? '',
  );
  protected typeLabel(t: string): string {
    return (this.i18n.t().practice.errorTypes as Record<string, string>)[t] ?? t;
  }
}
