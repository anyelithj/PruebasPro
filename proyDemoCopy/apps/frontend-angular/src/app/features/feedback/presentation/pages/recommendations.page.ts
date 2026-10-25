import { RouterLink } from '@angular/router';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import { BadgeComponent } from '@shared/ui/atoms/badge/badge.component';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { FeedbackFacade } from '../../application/feedback.facade';
// [RecommendationsPage · Presentación]: recomendaciones por debilidad + fortalezas + progreso por tema | [Patrón]: Container + Máquina de estados | [Principio]: SRP + DRY (misma fachada y misma carga que el plan) | [Paradigma]: Declarativo
// [A11y]: barras de progreso con <progress> nativo (valor anunciado) + porcentaje en texto

@Component({
  selector: 'aula-recommendations-page',
  imports: [RouterLink, CardPageTemplate, BadgeComponent, ButtonComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let t = i18n.t().feedback;
    <aula-card-page [heading]="t.recommendationsTitle" [subtitle]="t.recommendationsSubtitle">
      <!-- [Navegación hermana]: plan ↔ recomendaciones (el sidebar compartido muestra una sola entrada «Plan de estudio» para /estudio/*) -->
      <a pageActions aulaButton variant="outline" size="sm" routerLink="/estudio/plan">{{ t.planTitle }}</a>
      @switch (facade.plan.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <div role="alert" class="space-y-2 text-sm text-tone-danger">
            <p>{{ facade.plan.error() }}</p>
            <button aulaButton variant="outline" size="sm" type="button" (click)="facade.load(true)">{{ i18n.t().common.retry }}</button>
          </div>
        }
        @default {
          @if (facade.noData()) {
            <p class="py-6 text-center text-sm text-muted-foreground">{{ t.noData }}</p>
          } @else {
            <div class="grid gap-6 md:grid-cols-2">
              <section aria-labelledby="weak-title">
                <h2 id="weak-title" class="mb-2 text-sm font-bold">{{ t.weak }}</h2>
                @if (facade.plan.data(); as view) {
                  <ul class="space-y-2">
                    @for (w of view.weaknesses.weak_topics; track w.topic) {
                      <li class="rounded-xl border border-border p-3">
                        <div class="flex items-center justify-between gap-2">
                          <b>{{ w.topic }}</b>
                          <aula-badge tone="warning" icon="alert">{{ i18n.fmt(t.accuracy, { n: pct(w.accuracy) }) }}</aula-badge>
                        </div>
                        <p class="mt-1 text-sm text-muted-foreground">{{ w.recommendation }}</p>
                      </li>
                    }
                  </ul>
                  @if (view.weaknesses.strong_topics.length) {
                    <h2 class="mb-2 mt-4 text-sm font-bold">{{ t.strong }}</h2>
                    <p class="flex flex-wrap gap-1.5">
                      @for (s of view.weaknesses.strong_topics; track s) {
                        <aula-badge tone="info" icon="check">{{ s }}</aula-badge>
                      }
                    </p>
                  }
                } @else {
                  <p role="status" class="text-sm text-muted-foreground">{{ t.aiUnavailable }}</p>
                }
              </section>
              <section aria-labelledby="progress-title">
                <h2 id="progress-title" class="mb-2 text-sm font-bold">{{ i18n.shell().nav.studyPlan }}</h2>
                <ul class="space-y-3">
                  @for (row of progress(); track row.topic) {
                    <li>
                      <label class="flex justify-between text-sm" [attr.for]="'p-' + $index"><span>{{ row.topic }}</span><span>{{ row.pct }} %</span></label>
                      <progress class="h-2 w-full accent-primary" max="100" [id]="'p-' + $index" [value]="row.pct"></progress>
                    </li>
                  }
                </ul>
              </section>
            </div>
            <p class="mt-4 text-xs text-muted-foreground">{{ i18n.t().common.aiReview }}</p>
          }
        }
      }
    </aula-card-page>
  `,
})
export default class RecommendationsPage {
  protected readonly i18n = inject(I18nService);
  protected readonly facade = inject(FeedbackFacade);
  // `computed`: Record → lista ordenada de menor a mayor precisión (lo más débil primero)
  protected readonly progress = computed(() =>
    Object.entries(this.facade.progress())
      .map(([topic, acc]) => ({ topic, pct: this.pct(acc) }))
      .sort((a, b) => a.pct - b.pct),
  );

  constructor() {
    void this.facade.load();
  }

  protected pct(accuracy: number): number {
    return Math.round(accuracy * 100);
  }
}
