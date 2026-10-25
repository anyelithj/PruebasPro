import { ActivitySectionsComponent } from '@shared/ui/molecules/pill-nav/pill-nav.component'; // [2026-10-23]: pills de secciones de Actividades
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CEFR_LEVELS, LANGUAGES } from '@aula/shared-schemas';
import { I18nService } from '@core/i18n/i18n.service';
import { BadgeComponent } from '@shared/ui/atoms/badge/badge.component';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { GamesFacade } from '../../application/games.facade';
import { FAMILY_ORDER, GAME_INFO, type GameType } from '../../domain/models/game-type';
import { accuracy } from '../../domain/models/games';
import { GameCardComponent } from '../components/game-card.component';
// [GamesHubPage · Presentación · Sprint 8.8]: /juegos — catálogo agrupado por lo que entrenan (memoria léxica, asociación, recuperación, vocabulario activo, producción oral, fluidez, pronunciación), preferencias de idioma/nivel/dificultad y últimas partidas | [Patrón]: Container (smart) + Configuration-Driven UI (catálogo de NestJS + GAME_INFO) | [Principio]: SRP + OCP (juego nuevo = aparece solo) | [Paradigma]: Declarativo + Reactivo
// [Licencia · Sprint 8.17]: pie con la licencia del contenido (CC BY 4.0, propio) que entrega el backend · [Responsive]: grilla 1 → 2 → 3 → 4 columnas

@Component({
  selector: 'aula-games-hub-page',
  imports: [IconComponent, ActivitySectionsComponent, 
    RouterLink,
    CardPageTemplate,
    BadgeComponent,
    ButtonComponent,
    SpinnerComponent,
    GameCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().games;
    <!-- [2026-10-23 · 4.º pase]: mismo encabezado que Recursos → título «Actividades», la sección en el subtítulo y en la pill activa; sin caja (bare) -->
    <aula-card-page [heading]="i18n.t().common.activitySections.title" [subtitle]="tx.title + ' · ' + tx.subtitle" [bare]="true">
      <aula-activity-sections pageNav />
      <div pageActions class="flex flex-wrap gap-2">
        <a aulaButton variant="outline" size="sm" routerLink="/juegos/progreso"
          ><aula-icon name="trending-up" /> {{ tx.fluencyDashboard }}</a
        >
        <a aulaButton variant="outline" size="sm" routerLink="/vocabulario"
          ><aula-icon name="library" /> {{ i18n.t().vocabulary.openBank }}</a
        >
      </div>

      <!-- [Preferencias]: se pasan a cada juego por la URL (?lang=&level=&d=) -->
      <div class="mb-6 grid gap-3 rounded-xl bg-muted p-3 sm:grid-cols-3">
        <label class="text-xs font-semibold text-muted-foreground">
          {{ tx.language }}
          <select
            class="control mt-1 w-full bg-card"
            [value]="language()"
            (change)="language.set($any($event.target).value)"
          >
            @for (code of languages; track code) {
              <option [value]="code">{{ i18n.languageName(code) }}</option>
            }
          </select>
        </label>
        <label class="text-xs font-semibold text-muted-foreground">
          {{ tx.level }}
          <select
            class="control mt-1 w-full bg-card"
            [value]="level()"
            (change)="level.set($any($event.target).value)"
          >
            <option value="">{{ tx.anyLevel }}</option>
            @for (l of levels; track l) {
              <option [value]="l">{{ l }}</option>
            }
          </select>
        </label>
        <label class="text-xs font-semibold text-muted-foreground">
          {{ tx.difficulty }}
          <select
            class="control mt-1 w-full bg-card"
            [value]="difficulty()"
            (change)="difficulty.set(+$any($event.target).value)"
          >
            @for (d of tx.difficulties; track $index) {
              <option [value]="$index + 1">{{ d }}</option>
            }
          </select>
        </label>
      </div>

      @switch (games.catalog.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <p role="alert" class="text-sm text-tone-danger">{{ games.catalog.error() }}</p>
        }
        @case ('success') {
          @for (family of families; track family) {
            <section class="mb-8" [attr.aria-labelledby]="'family-' + family">
              <h2 class="mb-1 text-lg font-extrabold tracking-tight" [id]="'family-' + family">
                {{ tx.families[family] }}
              </h2>
              <p class="mb-3 max-w-3xl text-sm text-muted-foreground">{{ tx.familyIntro[family] }}</p>
              @if (family === 'agent') {
                <!-- [Guía · 2026-10-19]: cómo funciona el juego con el agente, en 4 pasos (antes no se entendía la interacción) -->
                <div class="mb-4 rounded-2xl border border-tone-brand-line bg-gradient-soft p-4">
                  <p class="mb-2 text-sm font-bold text-tone-brand"><aula-icon name="bot" /> {{ tx.agentStepsTitle }}</p>
                  <ol class="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    @for (step of tx.agentSteps; track step) {
                      <li class="rounded-xl bg-card px-3 py-2 shadow-sm">{{ step }}</li>
                    }
                  </ol>
                </div>
              }
              <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                @for (g of byFamily()[family]; track g.type) {
                  <li>
                    <aula-game-card
                      [link]="link(g.type)"
                      [query]="query()"
                      [icon]="info(g.type).icon"
                      [name]="g.title || tx.names[g.type]"
                      [skill]="g.skill"
                      [description]="g.description || tx.descriptions[g.type]"
                      [mic]="!!info(g.type).mic"
                      [playLabel]="tx.play"
                    />
                  </li>
                }
              </ul>
            </section>
          }
          @let lic = games.catalog.data()!.license;
          <p class="mt-2 border-t border-border pt-3 text-xs text-muted-foreground">
            ©
            {{
              i18n.fmt(tx.license, { license: lic.license, author: lic.author, source: lic.source })
            }}
          </p>
        }
      }

      <!-- [Historial]: últimas partidas con estado en texto y enlace al resultado -->
      <section class="mt-8" aria-labelledby="recent-games">
        <h2 id="recent-games" class="mb-3 text-lg font-extrabold">{{ tx.recentSessions }}</h2>
        @switch (games.history.status()) {
          @case ('success') {
            <ul class="divide-y divide-border rounded-xl border border-border">
              @for (s of recent(); track s.id) {
                <li class="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <span class="font-semibold"
                    ><aula-icon [name]="info(s.gameType).icon" /> {{ tx.names[s.gameType] }} ·
                    {{ i18n.languageName(s.language) }}</span
                  >
                  <span class="flex items-center gap-2">
                    <aula-badge
                      [tone]="
                        s.status === 'finished' ? 'brand' : s.status === 'active' ? 'info' : 'muted'
                      "
                      >{{ tx.status[s.status] }}</aula-badge
                    >
                    @if (s.status === 'finished') {
                      <span class="tabular-nums"
                        >{{ tx.score }}: {{ s.score }} · {{ pct(s) }} %</span
                      >
                    }
                    <a
                      class="font-semibold text-primary hover:underline"
                      [routerLink]="['/juegos/sesion', s.id]"
                      >{{ tx.seeResult }}</a
                    >
                  </span>
                </li>
              }
            </ul>
          }
          @case ('empty') {
            <p
              class="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground"
            >
              {{ tx.noSessions }}
            </p>
          }
          @case ('error') {
            <p role="alert" class="text-sm text-tone-danger">{{ games.history.error() }}</p>
          }
        }
      </section>
    </aula-card-page>
  `,
})
export default class GamesHubPage {
  protected readonly i18n = inject(I18nService);
  protected readonly games = inject(GamesFacade);
  protected readonly languages = LANGUAGES;
  protected readonly levels = CEFR_LEVELS;
  protected readonly families = FAMILY_ORDER;
  protected readonly language = signal('en');
  protected readonly level = signal('');
  protected readonly difficulty = signal(1);
  protected readonly info = (t: GameType) => GAME_INFO[t];
  protected readonly pct = accuracy;
  // [byFamily]: agrupa el catálogo según la familia de GAME_INFO (la del front decide la sección, el backend la habilidad)
  protected readonly byFamily = computed(() => {
    const games = this.games.catalog.data()?.games ?? [];
    return Object.fromEntries(
      this.families.map((f) => [f, games.filter((g) => GAME_INFO[g.type].family === f)]),
    ) as Record<(typeof FAMILY_ORDER)[number], typeof games>;
  });
  protected readonly recent = computed(() => (this.games.history.data() ?? []).slice(0, 8));
  protected readonly query = computed(() => ({
    lang: this.language(),
    ...(this.level() ? { level: this.level() } : {}),
    d: this.difficulty(),
  }));

  constructor() {
    void this.games.loadCatalog();
    void this.games.loadHistory();
  }

  // [link]: role-play primero elige escenario; el resto va directo al juego
  protected link(t: GameType): string {
    return `/juegos/${GAME_INFO[t].route}`;
  }
}
