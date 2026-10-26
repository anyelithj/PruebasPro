import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { BackLinkComponent } from '@shared/ui/atoms/back-link/back-link.component';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CEFR_LEVELS, LANGUAGES } from '@aula/shared-schemas';
import { I18nService } from '@core/i18n/i18n.service';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { GamesFacade } from '../../application/games.facade';
import { GAME_INFO, type GameType } from '../../domain/models/game-type';
import { accuracy, type GameSession, type StartInput } from '../../domain/models/games';
// [GameShellComponent · Presentación · Sprints 8.8–8.11]: armazón común de TODAS las partidas — elegir idioma/nivel/dificultad → jugar (contenido proyectado) → terminar o abandonar → resumen | [Patrón]: Template Method visual (el juego solo aporta su tablero) + Content Projection + State Machine (fase de GamesFacade) | [Principio]: DRY (18 juegos, un solo ciclo) + SRP | [Paradigma]: Declarativo + Reactivo
// [A11y]: progreso y aciertos en texto con `aria-live`, confirmación antes de abandonar, errores en role="alert" · [Responsive]: barra de partida que se envuelve en móvil

@Component({
  selector: 'aula-game-shell',
  imports: [IconComponent, 
    BackLinkComponent,RouterLink, ButtonComponent, CardPageTemplate],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }, // Elemento anfitrión en bloque → respeta márgenes y space-y del contenedor
  template: `
    @let tx = i18n.t().games;
    @let s = facade.session();
    <aula-card-page
      [heading]="tx.names[type()]"
      [subtitle]="tx.descriptions[type()]"
    >
      <a aulaBackLink pageBack routerLink="/juegos">{{
        tx.backToHub
      }}</a>
      @if (facade.error(); as err) {
        <p role="alert" class="mb-3 text-sm text-tone-danger">{{ err }}</p>
      }
      @switch (facade.phase()) {
        @case ('playing') {
          <!-- [Barra de partida]: ronda, aciertos y acciones -->
          <div
            class="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted px-3 py-2 text-sm"
          >
            <p aria-live="polite" class="font-semibold">
              {{ i18n.fmt(tx.progress, { n: (s?.roundsCount ?? 0) + 1 }) }}
              @if (scored()) {
                · {{ tx.accuracy }}: {{ pct() }} %
              }
            </p>
            <div class="flex gap-2">
              <button
                aulaButton
                size="sm"
                type="button"
                [loading]="facade.busy()"
                (click)="facade.finish()"
              >
                {{ tx.finish }}
              </button>
              <button aulaButton size="sm" variant="ghost" type="button" (click)="abandon()">
                {{ tx.abandon }}
              </button>
            </div>
          </div>
          @if (s?.content?.fallback) {
            <p role="status" class="mb-3 text-xs text-tone-warning">{{ tx.fallbackBank }}</p>
          }
          <ng-content />
        }
        @case ('finished') {
          <!-- [Resumen]: puntaje final calculado por NestJS -->
          <div class="space-y-4 text-center" role="status">
            <p class="text-4xl" aria-hidden="true"><aula-icon name="flag" [size]="36" /></p>
            <h2 class="text-xl font-extrabold">{{ tx.gameOver }}</h2>
            <p class="text-sm text-muted-foreground">
              {{ tx.score }}: <b class="text-foreground">{{ s?.score ?? 0 }}</b>
              @if (scored()) {
                · {{ tx.accuracy }}: <b class="text-foreground">{{ pct() }} %</b>
              }
            </p>
            <div class="flex flex-wrap justify-center gap-2">
              <a aulaButton variant="outline" [routerLink]="['/juegos/sesion', s?.id]">{{
                tx.seeResult
              }}</a>
              <button aulaButton type="button" (click)="begin()">{{ tx.playAgain }}</button>
            </div>
          </div>
        }
        @default {
          <!-- [Preparación]: idioma, nivel y dificultad (prellenados desde el hub por ?lang=&level=&d=) -->
          <ng-content select="[gameIntro]" />
          <form
            class="grid gap-3 sm:grid-cols-3 sm:items-end"
            (submit)="$event.preventDefault(); begin()"
          >
            <label class="text-xs font-semibold text-muted-foreground">
              {{ tx.language }}
              <select
                class="control mt-1 w-full"
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
                class="control mt-1 w-full"
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
                class="control mt-1 w-full"
                [value]="difficulty()"
                (change)="difficulty.set(+$any($event.target).value)"
              >
                @for (d of tx.difficulties; track $index) {
                  <option [value]="$index + 1">{{ d }}</option>
                }
              </select>
            </label>
            <button
              aulaButton
              type="submit"
              size="lg"
              class="sm:col-span-3 sm:justify-self-start"
              [loading]="facade.phase() === 'starting'"
              [disabled]="!canStart()"
            >
              {{ tx.start }}
            </button>
          </form>
        }
      }
    </aula-card-page>
  `,
})
export class GameShellComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly facade = inject(GamesFacade);
  private readonly route = inject(ActivatedRoute); // [2026-10-25]: ?mazo= del juego creado en Gestión
  readonly type = input.required<GameType>();
  readonly lang = input<string | undefined>(undefined); // Prellenado (?lang=)
  readonly lvl = input<string | undefined>(undefined); // ?level=
  readonly diff = input<string | number | undefined>(undefined); // ?d=
  readonly scenarioId = input<string | undefined>(undefined); // Role-play
  readonly canStart = input(true);
  readonly started = output<GameSession>();

  protected readonly languages = LANGUAGES;
  protected readonly levels = CEFR_LEVELS;
  protected readonly info = computed(() => GAME_INFO[this.type()]);
  // `signal` con valor inicial de la URL (el usuario puede cambiarlo antes de empezar)
  protected readonly language = signal('en');
  protected readonly level = signal('');
  protected readonly difficulty = signal(1);
  // [scored]: los juegos abiertos (agente, oral) no tienen aciertos → no se muestra el porcentaje
  protected readonly scored = computed(() => ['vocab', 'listening'].includes(this.info().family));
  protected readonly pct = computed(() =>
    accuracy(this.facade.session() ?? { roundsCount: 0, correctCount: 0 }),
  );

  constructor() {
    this.facade.reset(); // Cada juego empieza desde «preparar partida» (no hereda la de otra pantalla)
    queueMicrotask(() => {
      // `queueMicrotask`: los input() ya tienen el valor de la ruta → se copian una vez a los selectores
      if (this.lang()) this.language.set(this.lang()!);
      if (this.lvl()) this.level.set(this.lvl()!);
      if (this.diff()) this.difficulty.set(Math.min(Math.max(Number(this.diff()) || 1, 1), 3));
    });
  }

  protected async begin(): Promise<void> {
    const input: StartInput = {
      gameType: this.type(),
      language: this.language() as StartInput['language'],
      level: (this.level() || undefined) as StartInput['level'],
      difficulty: this.difficulty(),
      scenarioId: this.scenarioId(),
      // [2026-10-25]: ?mazo= → juego creado en Gestión con sus propias palabras | `snapshot` basta: la URL no cambia durante la partida
      deckId: this.route.snapshot.queryParamMap.get('mazo') ?? undefined,
    };
    const s = await this.facade.start(input);
    if (s) this.started.emit(s);
  }

  protected abandon(): void {
    if (confirm(this.i18n.t().games.confirmAbandon)) void this.facade.cancel();
  }
}
