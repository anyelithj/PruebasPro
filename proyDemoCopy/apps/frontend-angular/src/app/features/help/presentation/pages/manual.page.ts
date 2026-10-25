import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionService } from '@core/auth/session.service';
import { I18nService } from '@core/i18n/i18n.service';
import { BadgeComponent } from '@shared/ui/atoms/badge/badge.component';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { HelpFacade } from '../../application/help.facade';
import { anchor } from '../../domain/models/help';
import { GuideChatComponent } from '../components/guide-chat.component';
// [ManualPage · Presentación]: /ayuda/manual — tabla de contenido del manual de MI rol (el backend filtra por el JWT) + reindexar (ADMIN) + Agente Guía en línea | [Patrón]: Container + Máquina de estados | [Principio]: SRP + DIP + DRY (mismo chat que el widget) | [Paradigma]: Declarativo + Reactivo
// [A11y]: lista de artículos con sus secciones enlazadas (navegación por anclas) · resultado del reindexado en role="status" · [Responsive]: chat debajo en móvil, al lado desde lg

@Component({
  selector: 'aula-manual-page',
  imports: [RouterLink, CardPageTemplate, BadgeComponent, ButtonComponent, SpinnerComponent, GuideChatComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let t = i18n.t().help;
    <aula-card-page [heading]="t.manualTitle" [subtitle]="t.manualSubtitle">
      <a pageActions aulaButton variant="outline" size="sm" routerLink="/ayuda/faq">{{ t.faqTitle }}</a>
      @if (isAdmin()) {
        <button pageActions aulaButton size="sm" type="button" [loading]="facade.reindexing()" (click)="facade.reindex()">{{ t.reindex }}</button>
      }
      @if (facade.reindexResult(); as r) {
        <p role="status" class="mb-3 text-sm">
          {{ i18n.fmt(t.reindexDone, { articles: r.articles, updated: r.updated, faqs: r.faqsSeeded }) }}
          @if (r.sections === null || !r.faqIndexed) {
            <span class="block text-tone-warning">{{ t.reindexNoIndex }}</span>
          }
        </p>
      }
      @if (facade.actionError(); as err) {
        <p role="alert" class="mb-3 text-sm text-tone-danger">{{ err }}</p>
      }
      <div class="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section aria-label="{{ t.manualTitle }}">
          @switch (facade.manual.status()) {
            @case ('loading') {
              <aula-spinner [label]="i18n.t().common.loading" />
            }
            @case ('error') {
              <div role="alert" class="space-y-2 text-sm text-tone-danger">
                <p>{{ facade.manual.error() }}</p>
                <button aulaButton variant="outline" size="sm" type="button" (click)="facade.loadManual()">{{ i18n.t().common.retry }}</button>
              </div>
            }
            @case ('empty') {
              <p class="text-sm text-muted-foreground">{{ t.manualEmpty }}</p>
            }
            @default {
              <ul class="space-y-3">
                @for (a of facade.manual.data(); track a.slug) {
                  <li class="rounded-xl border border-border p-4">
                    <div class="flex flex-wrap items-center gap-2">
                      <a class="font-bold text-primary hover:underline" [routerLink]="['/ayuda/manual', a.slug]">{{ a.title }}</a>
                      <aula-badge>{{ t.roles[a.role] }}</aula-badge>
                    </div>
                    @if (a.sections.length) {
                      <p class="mt-2 text-xs font-semibold text-muted-foreground">{{ t.sections }}</p>
                      <ul class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        @for (s of a.sections; track s) {
                          <li><a class="hover:underline" [routerLink]="['/ayuda/manual', a.slug]" [fragment]="anchor(s)">{{ s }}</a></li>
                        }
                      </ul>
                    }
                  </li>
                }
              </ul>
            }
          }
        </section>
        <aside aria-labelledby="manual-guide-title" class="rounded-xl border border-border p-4">
          <h2 id="manual-guide-title" class="mb-2 text-base font-bold">{{ t.guideTitle }}</h2>
          <aula-guide-chat />
        </aside>
      </div>
    </aula-card-page>
  `,
})
export default class ManualPage {
  protected readonly i18n = inject(I18nService);
  protected readonly facade = inject(HelpFacade);
  private readonly session = inject(SessionService);
  protected readonly isAdmin = computed(() => this.session.hasRole('ADMIN'));
  protected readonly anchor = anchor;

  constructor() {
    void this.facade.loadManual();
  }
}
