import { RouterLink } from '@angular/router';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import { BadgeComponent } from '@shared/ui/atoms/badge/badge.component';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { FeedbackFacade } from '../../application/feedback.facade';
// [StudyPlanPage · Presentación]: plan de estudio personalizado (pasos ordenados con actividad y minutos) | [Patrón]: Container + Máquina de estados (carga/sin datos/IA no disponible/error/éxito) | [Principio]: SRP + DIP | [Paradigma]: Declarativo
// [A11y]: <ol> conserva el orden para lectores de pantalla · aviso de contenido IA visible

@Component({
  selector: 'aula-study-plan-page',
  imports: [RouterLink, CardPageTemplate, BadgeComponent, ButtonComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let t = i18n.t().feedback;
    <aula-card-page [heading]="t.planTitle" [subtitle]="t.planSubtitle">
      <!-- [Navegación hermana]: plan ↔ recomendaciones (el sidebar compartido muestra una sola entrada «Plan de estudio» para /estudio/*) -->
      <a pageActions aulaButton variant="outline" size="sm" routerLink="/estudio/recomendaciones">{{ t.recommendationsTitle }}</a>
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
          } @else if (facade.plan.data()?.plan; as plan) {
            <ol class="space-y-3">
              @for (step of plan.plan; track step.order) {
                <li class="flex gap-3 rounded-xl border border-border p-3">
                  <span class="grid size-8 shrink-0 place-items-center rounded-full bg-tone-brand-soft text-sm font-bold text-tone-brand" aria-hidden="true">{{ step.order }}</span>
                  <div class="min-w-0 flex-1">
                    <p class="font-semibold">{{ step.topic }}</p>
                    <p class="text-sm text-muted-foreground">{{ step.activity }}</p>
                  </div>
                  <aula-badge tone="info">{{ i18n.fmt(t.minutes, { n: step.estimated_minutes }) }}</aula-badge>
                </li>
              }
            </ol>
            <p class="mt-4 text-sm font-semibold">{{ i18n.fmt(t.total, { n: plan.total_minutes }) }}</p>
            <p class="mt-2 text-xs text-muted-foreground">{{ i18n.t().common.aiReview }}</p>
          } @else {
            <p role="status" class="py-6 text-center text-sm text-muted-foreground">{{ t.aiUnavailable }}</p>
          }
        }
      }
    </aula-card-page>
  `,
})
export default class StudyPlanPage {
  protected readonly i18n = inject(I18nService);
  protected readonly facade = inject(FeedbackFacade);

  constructor() {
    void this.facade.load();
  }
}
