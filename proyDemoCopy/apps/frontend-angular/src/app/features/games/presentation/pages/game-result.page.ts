import { BackLinkComponent } from '@shared/ui/atoms/back-link/back-link.component';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '@core/i18n/i18n.service';
import { BadgeComponent } from '@shared/ui/atoms/badge/badge.component';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { GamesFacade } from '../../application/games.facade';
import { GAME_INFO } from '../../domain/models/game-type';
import { accuracy, type FluencyMetric } from '../../domain/models/games';
import { MetricCardComponent } from '../components/metric-card.component';
// [GameResultPage · Presentación · Sprint 8.8/8.11]: /juegos/sesion/:id — resumen de la partida: puntaje, aciertos, rondas con tiempos y métricas de fluidez | [Patrón]: Container (smart) + Presentational (MetricCard) | [Principio]: SRP + DIP | [Paradigma]: Declarativo
// [A11y]: tabla con <caption> y encabezados, resultado de cada ronda con icono + texto · [Responsive]: tabla con desplazamiento propio en móvil

@Component({
  selector: 'aula-game-result-page',
  imports: [
    BackLinkComponent,
    RouterLink,
    CardPageTemplate,
    BadgeComponent,
    ButtonComponent,
    SpinnerComponent,
    MetricCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().games;
    @switch (games.result.status()) {
      @case ('loading') {
        <aula-spinner [label]="i18n.t().common.loading" />
      }
      @case ('error') {
        <aula-card-page [heading]="tx.resultTitle">
          <p role="alert" class="text-sm text-tone-danger">{{ games.result.error() }}</p>
        </aula-card-page>
      }
      @case ('success') {
        @let r = games.result.data()!;
        @let s = r.session;
        <aula-card-page
          [heading]="tx.names[s.gameType]"
          [subtitle]="
            tx.resultTitle +
            ' · ' +
            i18n.languageName(s.language) +
            (s.level ? ' · ' + s.level : '')
          "
        >
          <a aulaBackLink pageBack routerLink="/juegos">{{ tx.backToHub }}</a>
          <div pageActions class="flex flex-wrap gap-2">
            <a
              aulaButton
              size="sm"
              [routerLink]="['/juegos', route(s.gameType)]"
              [queryParams]="{ lang: s.language }"
              >{{ tx.playAgain }}</a
            >
          </div>
          <div class="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <aula-metric-card [label]="tx.score" [value]="s.score" />
            <aula-metric-card
              [label]="tx.accuracy"
              [value]="pct(s) + ' %'"
              [hint]="s.correctCount + ' / ' + s.roundsCount"
            />
            <aula-metric-card [label]="tx.rounds" [value]="r.rounds.length" />
            <aula-metric-card [label]="tx.colResult" [value]="tx.status[s.status]" />
          </div>
          @if (avg(); as m) {
            <h2 class="mb-2 text-base font-bold">{{ tx.fluencyTitle }}</h2>
            <div class="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <aula-metric-card
                [label]="tx.timeToRespond"
                [value]="i18n.fmt(tx.seconds, { n: m.timeToRespondS })"
              />
              <aula-metric-card [label]="tx.wpm" [value]="m.wordsPerMinute" />
              <aula-metric-card
                [label]="tx.longestRun"
                [value]="i18n.fmt(tx.seconds, { n: m.longestRunS })"
              />
              <aula-metric-card [label]="tx.reuse" [value]="m.reuseRatio + ' %'" />
            </div>
          }
          <h2 class="mb-2 text-base font-bold">{{ tx.rounds }}</h2>
          @if (r.rounds.length) {
            <div class="overflow-x-auto rounded-xl border border-border">
              <table class="w-full min-w-[32rem] text-left text-sm">
                <caption class="sr-only">
                  {{
                    tx.rounds
                  }}
                </caption>
                <thead class="bg-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th scope="col" class="px-3 py-2">{{ tx.colRound }}</th>
                    <th scope="col" class="px-3 py-2">{{ tx.colAnswer }}</th>
                    <th scope="col" class="px-3 py-2">{{ tx.colResult }}</th>
                    <th scope="col" class="px-3 py-2">{{ tx.colTime }}</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  @for (round of r.rounds; track round.id) {
                    <tr>
                      <td class="px-3 py-2 tabular-nums">{{ round.index }}</td>
                      <td class="px-3 py-2" [attr.lang]="s.language">{{ round.answer }}</td>
                      <td class="px-3 py-2">
                        @if (round.correct === true) {
                          <aula-badge tone="brand">✓ {{ tx.correct }}</aula-badge>
                        } @else if (round.correct === false) {
                          <aula-badge tone="danger">✗ {{ tx.wrong }}</aula-badge>
                        } @else {
                          <aula-badge>{{ tx.open }}</aula-badge>
                        }
                      </td>
                      <td class="px-3 py-2 tabular-nums">
                        {{
                          round.timeToAnswerMs !== null
                            ? (round.timeToAnswerMs / 1000).toFixed(1) + ' s'
                            : '—'
                        }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="text-sm text-muted-foreground">{{ tx.noRounds }}</p>
          }
        </aula-card-page>
      }
    }
  `,
})
export default class GameResultPage {
  protected readonly i18n = inject(I18nService);
  protected readonly games = inject(GamesFacade);
  readonly id = input<string>(); // Opcional: el router lo rellena (withComponentInputBinding); sin valor no se carga nada // /juegos/sesion/:id
  protected readonly pct = accuracy;
  protected readonly route = (t: keyof typeof GAME_INFO) => GAME_INFO[t].route;
  // [avg]: promedio de las métricas de la partida (redondeado) | `reduce` (ES5)
  protected readonly avg = computed(() => {
    const m = this.games.result.data()?.metrics ?? [];
    if (!m.length) return null;
    const mean = (k: keyof FluencyMetric) =>
      Math.round((m.reduce((a, x) => a + Number(x[k]), 0) / m.length) * 10) / 10;
    return {
      timeToRespondS: mean('timeToRespondS'),
      wordsPerMinute: mean('wordsPerMinute'),
      longestRunS: mean('longestRunS'),
      reuseRatio: Math.round(mean('reuseRatio') * 100),
    };
  });

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) untracked(() => void this.games.loadResult(id));
    });
  }
}
