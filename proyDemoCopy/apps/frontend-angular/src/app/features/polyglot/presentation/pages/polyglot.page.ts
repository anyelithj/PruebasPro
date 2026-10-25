import { ActivitySectionsComponent } from '@shared/ui/molecules/pill-nav/pill-nav.component'; // [2026-10-23]: pills de secciones de Actividades
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LANGUAGES } from '@aula/shared-schemas';
import { SessionService } from '@core/auth/session.service';
import { I18nService } from '@core/i18n/i18n.service';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { AccentSwitchComponent } from '@shared/ui/molecules/accent-switch/accent-switch.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { PolyglotFacade } from '../../application/polyglot.facade';
import type { View } from '../../domain/models/polyglot';
import { LanguagePickerComponent } from '../components/language-picker.component';
import { PolyglotCardsComponent } from '../components/polyglot-cards.component';
import { PolyglotTableComponent } from '../components/polyglot-table.component';
import { PolyglotTopicPickerComponent } from '../components/polyglot-topic-picker.component';
// [PolyglotPage · Presentación · Sprint 10.7 · RF-129 a RF-131, RF-138]: /poliglota — elegir tema e idiomas (y su orden), ver la tabla con imagen, término, IPA y sonido (tarjetas en móviles) y guardar la comparación | [Patrón]: Container (smart) + Facade | [Principio]: SRP + responsive + accesibilidad | [Paradigma]: Declarativo + Reactivo
// [Jerarquía visual]: 1) tema (botones grandes) · 2) idiomas · 3) tabla, que ocupa el ancho · comparaciones guardadas al final

@Component({
  selector: 'aula-polyglot-page',
  imports: [IconComponent, ActivitySectionsComponent, 
    RouterLink,
    CardPageTemplate,
    SpinnerComponent,
    AccentSwitchComponent,
    PolyglotTopicPickerComponent,
    LanguagePickerComponent,
    PolyglotTableComponent,
    PolyglotCardsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().polyglot;
    <!-- [2026-10-23 · 4.º pase]: mismo encabezado que Recursos → título «Actividades», la sección en el subtítulo y en la pill activa; sin caja (bare) -->
    <aula-card-page [heading]="i18n.t().common.activitySections.title" [subtitle]="tx.title + ' · ' + tx.subtitle" [bare]="true">
      <aula-activity-sections pageNav />
      <div pageActions class="flex flex-wrap items-center gap-2">
        @if (staff()) {
          <a routerLink="/poliglota/administrar" class="btn btn-outline btn-sm"><aula-icon name="settings" /> {{ tx.manage }}</a>
        }
      </div>

      @switch (p.topics.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <p role="alert" class="text-sm text-tone-danger">{{ p.topics.error() }}</p>
        }
        @case ('empty') {
          <p class="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{{ tx.noTopics }}</p>
        }
        @case ('success') {
          <div class="space-y-6">
            <section aria-labelledby="pg-topic">
              <h2 id="pg-topic" class="mb-2 text-sm font-bold">{{ tx.topic }}</h2>
              <aula-polyglot-topic-picker
                [topics]="p.topics.data() ?? []"
                [selected]="p.topicId()"
                [label]="tx.topic"
                [labels]="{ choose: tx.chooseTopic, categories: tx.categories }"
                (picked)="p.selectTopic($event)"
              />
            </section>

            <aula-language-picker
              [order]="p.languages()"
              [names]="names()"
              [legend]="tx.languages"
              [hint]="tx.languagesHint"
              [upLabel]="tx.up"
              [downLabel]="tx.down"
              [restoreLabel]="tx.restore"
              (toggled)="p.toggleLanguage($event)"
              (moved)="p.moveLanguage($event.lang, $event.delta)"
              (dropped)="p.dropLanguage($event.from, $event.to)"
              (restored)="p.restoreOrder()"
            />

            @switch (p.table.status()) {
              @case ('loading') {
                <aula-spinner [label]="i18n.t().common.loading" />
              }
              @case ('error') {
                <p role="alert" class="text-sm text-tone-danger">{{ p.table.error() }}</p>
              }
              @case ('empty') {
                <p class="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{{ tx.empty }}</p>
              }
              @case ('success') {
                @if (p.table.data(); as t) {
                  <div class="hidden md:block">
                    <aula-polyglot-table
                      [rows]="t.rows"
                      [languages]="p.languages()"
                      [names]="names()"
                      [caption]="tx.tableCaption.replace('{topic}', t.topic.title)"
                      [accentLabel]="i18n.t().dictionary.accent"
                      [imageLabel]="tx.image"
                      [listenLabel]="tx.listen"
                      [missingLabel]="tx.missing"
                      [unreviewedLabel]="tx.unreviewed"
                      [nativeLabel]="tx.nativeReview"
                    />
                  </div>
                  <div class="space-y-2 md:hidden">
                    @if (languagesHaveEnglish()) {
                      <!-- [Móvil]: el interruptor UK/US va junto a las tarjetas (en escritorio está en la columna de inglés) -->
                      <aula-accent-switch [label]="i18n.t().dictionary.accent" />
                    }
                    <aula-polyglot-cards
                      [rows]="t.rows"
                      [languages]="p.languages()"
                      [names]="names()"
                      [label]="tx.cardsLabel.replace('{topic}', t.topic.title)"
                      [listenLabel]="tx.listen"
                      [missingLabel]="tx.missing"
                      [nativeLabel]="tx.nativeReview"
                    />
                  </div>
                  <form class="flex flex-wrap items-end gap-2" (submit)="$event.preventDefault(); save()">
                    <label class="min-w-48 flex-1 text-xs font-semibold">
                      {{ tx.viewName }}
                      <input class="control mt-1 w-full" maxlength="120" [placeholder]="t.topic.title" [value]="viewName()" (input)="viewName.set($any($event.target).value)" />
                    </label>
                    <button type="submit" class="btn btn-primary" [disabled]="p.busy()"><aula-icon name="save" /> {{ tx.saveView }}</button>
                  </form>
                }
              }
            }
            <p class="text-sm" aria-live="polite">
              @if (p.notice()) {
                <span class="text-tone-brand">✓ {{ p.notice() }}</span>
              }
              @if (p.actionError()) {
                <span role="alert" class="text-tone-danger">{{ p.actionError() }}</span>
              }
            </p>

            <section aria-labelledby="pg-views" class="border-t border-border pt-5">
              <h2 id="pg-views" class="mb-3 text-lg font-extrabold">{{ tx.myViews }}</h2>
              @if (p.views.status() === 'success') {
                <ul class="flex flex-wrap gap-2">
                  @for (v of p.views.data(); track v.id) {
                    <li class="flex items-center gap-1 rounded-full border border-border bg-card py-1 pl-3 pr-1 text-sm">
                      <span class="font-semibold">{{ v.name }}</span>
                      <span class="text-xs text-muted-foreground">({{ langList(v) }})</span>
                      <button type="button" class="btn btn-ghost btn-sm" (click)="p.openView(v)">{{ tx.openView }}</button>
                      <button type="button" class="btn btn-ghost btn-sm text-tone-danger" [attr.aria-label]="tx.deleteView + ': ' + v.name" (click)="p.deleteView(v.id)">✕</button>
                    </li>
                  }
                </ul>
              } @else {
                <p class="text-sm text-muted-foreground">{{ tx.noViews }}</p>
              }
            </section>
          </div>
        }
      }
    </aula-card-page>
  `,
})
export default class PolyglotPage {
  protected readonly i18n = inject(I18nService);
  protected readonly p = inject(PolyglotFacade);
  private readonly session = inject(SessionService);
  protected readonly staff = computed(() => this.session.hasRole('TEACHER', 'ADMIN'));
  protected readonly viewName = signal('');
  protected readonly names = computed(() =>
    Object.fromEntries(LANGUAGES.map((c) => [c, this.i18n.languageName(c)])),
  );
  protected readonly languagesHaveEnglish = computed(() => this.p.languages().includes('en'));

  constructor() {
    void this.p.loadTopics();
    void this.p.loadViews();
  }

  protected async save(): Promise<void> {
    if (await this.p.saveView(this.viewName().trim())) {
      this.p.notice.set(this.i18n.t().polyglot.saved);
      this.viewName.set('');
    }
  }

  protected langList(v: View): string {
    return v.languages.map((l) => this.names()[l] ?? l).join(', ');
  }
}
