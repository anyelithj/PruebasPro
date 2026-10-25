import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CEFR_LEVELS, LANGUAGES } from '@aula/shared-schemas';
import { SessionService } from '@core/auth/session.service';
import { I18nService } from '@core/i18n/i18n.service';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { GrammarFacade } from '../../application/grammar.facade';
// [GrammarListPage · Presentación · Sprint 10.11 · RF-133]: /gramatica — fichas publicadas por idioma y nivel; el docente entra al editor | [Patrón]: Container (smart) + Facade | [Principio]: SRP + responsive (rejilla 1 → 3 columnas) | [Paradigma]: Declarativo + Reactivo

@Component({
  selector: 'aula-grammar-list-page',
  imports: [IconComponent, RouterLink, CardPageTemplate, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().grammar;
    <aula-card-page [heading]="tx.title" [subtitle]="tx.subtitle">
      @if (staff()) {
        <a pageActions routerLink="/gramatica/editor" class="btn btn-primary btn-sm"><aula-icon name="pencil" /> {{ tx.editor.title }}</a>
      }
      <div class="mb-5 flex flex-wrap gap-3">
        <label class="min-w-40 flex-1 text-xs font-semibold text-muted-foreground">
          {{ tx.language }}
          <select class="control mt-1 w-full" [value]="language()" (change)="language.set($any($event.target).value)">
            @for (l of langs; track l) {
              <option [value]="l">{{ i18n.languageName(l) }}</option>
            }
          </select>
        </label>
        <label class="min-w-32 text-xs font-semibold text-muted-foreground">
          {{ tx.level }}
          <select class="control mt-1 w-full" [value]="level()" (change)="level.set($any($event.target).value)">
            <option value="">{{ tx.anyLevel }}</option>
            @for (l of levels; track l) {
              <option [value]="l">{{ l }}</option>
            }
          </select>
        </label>
      </div>
      @switch (g.topics.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <p role="alert" class="text-sm text-tone-danger">{{ g.topics.error() }}</p>
        }
        @case ('empty') {
          <p class="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{{ tx.empty }}</p>
        }
        @case ('success') {
          <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            @for (t of g.topics.data(); track t.id) {
              <li>
                <a
                  [routerLink]="['/gramatica', t.id]"
                  class="surface group flex h-full flex-col gap-2 overflow-hidden p-4 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style="border-top: 3px solid var(--primary)"
                >
                  <span class="flex flex-wrap gap-1.5 text-xs">
                    <span class="badge bg-tone-brand-soft text-tone-brand">{{ i18n.languageName(t.language ?? '') }}</span>
                    @for (lv of t.levels; track lv) {
                      <span class="badge bg-muted text-muted-foreground">{{ lv }}</span>
                    }
                    @if (t.status === 'draft') {
                      <span class="badge bg-tone-warning-soft text-tone-warning">{{ tx.editor.status.draft }}</span>
                    }
                  </span>
                  <span class="text-lg font-extrabold leading-tight group-hover:text-primary" [attr.lang]="t.language">{{ t.title }}</span>
                  <span class="text-sm text-muted-foreground">{{ t.summary }}</span>
                  <span class="mt-auto text-sm font-semibold text-primary">{{ tx.open }} →</span>
                </a>
              </li>
            }
          </ul>
        }
      }
    </aula-card-page>
  `,
})
export default class GrammarListPage {
  protected readonly i18n = inject(I18nService);
  protected readonly g = inject(GrammarFacade);
  private readonly session = inject(SessionService);
  protected readonly langs = LANGUAGES;
  protected readonly levels = CEFR_LEVELS;
  protected readonly language = signal('en');
  protected readonly level = signal('');
  protected readonly staff = computed(() => this.session.hasRole('TEACHER', 'ADMIN'));

  constructor() {
    effect(() => void this.g.loadTopics({ language: this.language(), level: this.level() || undefined }));
  }
}
