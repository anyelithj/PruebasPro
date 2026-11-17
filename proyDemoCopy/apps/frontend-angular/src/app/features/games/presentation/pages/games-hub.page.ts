import { ActivitySectionsComponent } from '@shared/ui/molecules/pill-nav/pill-nav.component'; // [2026-10-23]: pills de secciones de Actividades
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { GamesRepository } from '../../domain/games.repository.port';
import { RouterLink } from '@angular/router';
import { CEFR_LEVELS } from '@aula/shared-schemas';
import { FilterPanelComponent } from '@shared/ui/molecules/filter-panel/filter-panel.component'; // [2026-11-11]: panel común
import { I18nService } from '@core/i18n/i18n.service';
import { BadgeComponent } from '@shared/ui/atoms/badge/badge.component';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { GamesFacade } from '../../application/games.facade';
import { FAMILY_ORDER, GAME_INFO, type GameType } from '../../domain/models/game-type';
import { accuracy } from '../../domain/models/games';
import { GameCardComponent } from '../components/game-card.component';
// [GamesHubPage · Presentación · Sprint 8.8]: /juegos — catálogo agrupado por lo que entrenan (memoria léxica, asociación, recuperación, vocabulario activo, producción oral, fluidez, pronunciación), preferencias de idioma/nivel/dificultad y últimas partidas | [Patrón]: Container (smart) + Configuration-Driven UI (catálogo de NestJS + GAME_INFO) | [Principio]: SRP + OCP (juego nuevo = aparece solo) | [Paradigma]: Declarativo + Reactivo
// [Licencia · Sprint 8.17]: pie con la licencia del contenido (CC BY 4.0, propio) que entrega el backend · [Responsive]: grilla 1 → 2 → 3 → 4 columnas

const fold = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

@Component({
  selector: 'aula-games-hub-page',
  imports: [IconComponent, ActivitySectionsComponent, FilterPanelComponent,
    RouterLink,
    CardPageTemplate,
    BadgeComponent,
    SpinnerComponent,
    GameCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().games;
    <!-- [2026-10-23 · 4.º pase]: mismo encabezado que Recursos → título «Actividades», la sección en el subtítulo y en la pill activa; sin caja (bare) -->
    <aula-card-page [heading]="i18n.t().common.activitySections.title" [subtitle]="tx.title + ' · ' + tx.subtitle" [bare]="true">
      <aula-activity-sections pageNav />
      <!-- [2026-11-03]: sin «Mi fluidez» ni «Mi vocabulario» en la cabecera (siguen en sus rutas /juegos/progreso y /vocabulario) -->

      <!-- [2026-11-06 · Hub ordenado]: preferencias en UNA barra · pills por familia (antes 4 secciones largas) · una tarjeta por tipo con su nº de juegos
           · tipo con juegos creados → «Todos los juegos de Parejas» con buscador por tema | las preferencias viajan a cada juego por la URL (?lang=&level=&d=) -->
      <!-- [2026-11-11]: MISMO panel de filtros que Gestión → Actividades (Buscar · Nivel · Dificultad · Filtrar · Limpiar + idiomas) · el idioma siempre está elegido (cada juego es de uno) -->
      <aula-filter-panel [(search)]="search" [(level)]="level" [(language)]="language" [languageAll]="false" [searchPlaceholder]="tx.searchTopic" (cleared)="difficulty.set(1)">
        <label class="filter-field">
          {{ tx.difficulty }}
          <select class="control" [value]="difficulty()" (change)="difficulty.set(+$any($event.target).value)">
            @for (d of tx.difficulties; track $index) {
              <option [value]="$index + 1" [selected]="$index + 1 === difficulty()">{{ d }}</option>
            }
          </select>
        </label>
      </aula-filter-panel>

      @switch (games.catalog.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <p role="alert" class="text-tone-danger">{{ games.catalog.error() }}</p>
        }
        @case ('success') {
          @if (selected(); as type) {
            <!-- ───── Todos los juegos de un tipo ───── -->
            <section aria-labelledby="type-decks" class="space-y-4">
              <button type="button" class="btn btn-ghost btn-sm" (click)="selected.set(null)">← {{ tx.backToTypes }}</button>
              <div class="flex flex-wrap items-center gap-3">
                <span class="grid size-11 place-items-center rounded-xl bg-tone-brand-soft text-tone-brand"><aula-icon [name]="info(type).icon" [size]="22" /></span>
                <h2 class="title-section" id="type-decks">{{ i18n.fmt(tx.allDecksOf, { game: tx.names[type] }) }}</h2>
                <a class="btn btn-primary btn-sm ml-auto" [routerLink]="link(type)" [queryParams]="query()">▶ {{ tx.playGeneral }}</a>
              </div>
              <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                @for (d of decksOf(type); track d.id) {
                  <li>
                    <a
                      class="surface flex h-full flex-col gap-1 p-4 text-foreground no-underline hover:-translate-y-0.5 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      [routerLink]="link(type)"
                      [queryParams]="{ mazo: d.id, lang: d.language, d: difficulty() }"
                    >
                      <span class="font-bold">{{ d.title }}</span>
                      <span class="flex flex-wrap items-center gap-1.5 type-meta text-muted-foreground">
                        @if (d.level) {
                          <span class="badge bg-tone-brand-soft text-tone-brand">{{ d.level }}</span>
                        }
                        <span>{{ i18n.fmt(tx.deckWords, { n: d.items.length }) }}</span>
                      </span>
                      <span class="mt-auto pt-1 text-sm font-semibold text-primary">{{ tx.play }} →</span>
                    </a>
                  </li>
                } @empty {
                  <li class="col-span-full rounded-xl border border-dashed border-border p-4 text-center text-muted-foreground">{{ tx.noDecks }}</li>
                }
              </ul>
            </section>
          } @else {
            <!-- ───── Tipos de juego ───── -->
            <div class="mb-3 flex flex-wrap gap-2" role="group" [attr.aria-label]="tx.title">
              <button type="button" class="btn btn-sm" [class]="family() === null ? 'btn-primary' : 'btn-outline'" [attr.aria-pressed]="family() === null" (click)="family.set(null)">{{ tx.allFamilies }}</button>
              @for (f of families; track f) {
                <button type="button" class="btn btn-sm" [class]="family() === f ? 'btn-primary' : 'btn-outline'" [attr.aria-pressed]="family() === f" (click)="family.set(f)">{{ tx.families[f] }}</button>
              }
            </div>
            @if (family(); as f) {
              <p class="mb-3 max-w-3xl text-muted-foreground">{{ tx.familyIntro[f] }}</p>
            }
            <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              @for (g of visible(); track g.type) {
                <li class="relative">
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
                  @if (deckCount()[g.type]; as n) {
                    <!-- Tipo con juegos creados → ver todos (por tema) -->
                    <button type="button" class="badge absolute right-3 top-3 z-10 cursor-pointer bg-tone-info-soft text-tone-info hover:underline" (click)="open(g.type)">
                      {{ i18n.fmt(tx.deckCount, { n }) }} · {{ tx.seeAll }}
                    </button>
                  }
                </li>
              }
            </ul>
          }
          @let lic = games.catalog.data()!.license;
          <p class="mt-6 border-t border-border pt-3 type-meta text-muted-foreground">
            ©
            {{
              i18n.fmt(tx.license, { license: lic.license, author: lic.author, source: lic.source })
            }}
          </p>
        }
      }

      <!-- [Historial]: últimas partidas con estado en texto y enlace al resultado -->
      <details class="mt-6">
        <summary class="cursor-pointer"><h2 id="recent-games" class="title-section inline">{{ tx.recentSessions }}</h2></summary>
        @switch (games.history.status()) {
          @case ('success') {
            <ul class="divide-y divide-border rounded-xl border border-border">
              @for (s of recent(); track s.id) {
                <li class="flex flex-wrap items-center justify-between gap-2 p-3">
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
              class="rounded-xl border border-dashed border-border p-4 text-center text-muted-foreground"
            >
              {{ tx.noSessions }}
            </p>
          }
          @case ('error') {
            <p role="alert" class="text-tone-danger">{{ games.history.error() }}</p>
          }
        }
      </details>
    </aula-card-page>
  `,
})
export default class GamesHubPage {
  protected readonly i18n = inject(I18nService);
  protected readonly games = inject(GamesFacade);
  protected readonly levels = CEFR_LEVELS;
  protected readonly families = FAMILY_ORDER;
  protected readonly language = signal('en');
  protected readonly level = signal('');
  protected readonly difficulty = signal(1);
  protected readonly family = signal<(typeof FAMILY_ORDER)[number] | null>(null); // null = todas
  protected readonly selected = signal<GameType | null>(null); // Tipo abierto → todos sus juegos
  protected readonly search = signal('');
  protected readonly info = (t: GameType) => GAME_INFO[t];
  protected readonly pct = accuracy;
  // [visible]: catálogo filtrado por la familia elegida, en el orden de FAMILY_ORDER
  protected readonly visible = computed(() => {
    const games = (this.games.catalog.data()?.games ?? []).filter((g) => g.type in GAME_INFO);
    const order = (t: GameType) => this.families.indexOf(GAME_INFO[t].family);
    // [2026-11-11]: «Buscar» del panel → tipos cuyo nombre coincide o que tienen juegos con ese título/tema
    const q = fold(this.search().trim());
    const hit = (t: GameType) => !q || fold(this.i18n.t().games.names[t]).includes(q) || this.myDecks().some((d) => d.gameType === t && fold(`${d.title} ${d.topic ?? ''}`).includes(q));
    return games.filter((g) => (!this.family() || GAME_INFO[g.type].family === this.family()) && hit(g.type)).sort((x, y) => order(x.type) - order(y.type));
  });
  private readonly decks = toSignal(inject(GamesRepository).decks().pipe(catchError(() => of([]))), { initialValue: [] });
  // [myDecks]: mazos publicados del idioma y nivel elegidos con un juego conocido
  protected readonly myDecks = computed(() =>
    this.decks()
      .filter((d) => d.gameType in GAME_INFO && d.language.toLowerCase() === this.language() && (!this.level() || d.level === this.level()))
      .map((d) => ({ ...d, gameType: d.gameType as GameType })),
  );
  protected readonly deckCount = computed(() => {
    const out: Partial<Record<GameType, number>> = {};
    for (const d of this.myDecks()) out[d.gameType] = (out[d.gameType] ?? 0) + 1;
    return out;
  });
  // [decksOf]: juegos de un tipo filtrados por el buscador (título o tema, sin tildes)
  protected decksOf(type: GameType) {
    const q = fold(this.search().trim());
    return this.myDecks().filter((d) => d.gameType === type && (!q || fold(`${d.title} ${d.topic ?? ''}`).includes(q)));
  }
  protected open(type: GameType): void {
    this.selected.set(type); // La búsqueda del panel se conserva
  }
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
