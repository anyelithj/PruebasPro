import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { BackLinkComponent } from '@shared/ui/atoms/back-link/back-link.component';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '@core/i18n/i18n.service';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { GamesFacade } from '../../application/games.facade';
import { GAME_INFO } from '../../domain/models/game-type';
import type { FluencyMetric } from '../../domain/models/games';
import { MetricCardComponent } from '../components/metric-card.component';
import { TrendChartComponent } from '../components/trend-chart.component';
// [FluencyDashboardPage · Presentación · Sprint 8.11]: /juegos/progreso — panel de fluidez: tiempo hasta responder, continuidad (pausas y tramo más largo), palabras producidas, vocabulario reutilizado y tendencia de palabras por minuto | [Patrón]: Container (smart) + Presentational (MetricCard, TrendChart en SVG propio) | [Principio]: SRP + DIP + sin librería de gráficas nueva | [Paradigma]: Declarativo + Funcional (promedios puros)
// [Privacidad]: «Borrar mi historial» elimina las métricas propias (DELETE /api/games/fluency/me) previa confirmación

@Component({
  selector: 'aula-fluency-dashboard-page',
  imports: [IconComponent, 
    BackLinkComponent,
    RouterLink,
    CardPageTemplate,
    ButtonComponent,
    SpinnerComponent,
    MetricCardComponent,
    TrendChartComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().games;
    <aula-card-page [heading]="tx.fluencyTitle" [subtitle]="tx.fluencySubtitle">
      <a aulaBackLink pageBack routerLink="/juegos">{{ tx.backToHub }}</a>
      <div pageActions class="flex flex-wrap gap-2">
        @if (games.fluency.status() === 'success') {
          <button
            aulaButton
            variant="ghost"
            size="sm"
            type="button"
            class="text-tone-danger"
            [loading]="games.busy()"
            (click)="clear()"
          >
            {{ tx.clearFluency }}
          </button>
        }
      </div>
      @switch (games.fluency.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <p role="alert" class="text-sm text-tone-danger">{{ games.fluency.error() }}</p>
        }
        @case ('empty') {
          <div class="rounded-xl border border-dashed border-border p-6 text-center">
            <p class="mb-3 text-sm text-muted-foreground">{{ tx.noFluency }}</p>
            <a aulaButton routerLink="/juegos/tema"><aula-icon name="dices" /> {{ tx.names.random_topic }}</a>
          </div>
        }
        @case ('success') {
          @let a = avg()!;
          <div class="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            <aula-metric-card
              [label]="tx.timeToRespond"
              [value]="i18n.fmt(tx.seconds, { n: a.timeToRespondS })"
            />
            <aula-metric-card
              [label]="tx.speakingTime"
              [value]="i18n.fmt(tx.seconds, { n: a.speakingTimeS })"
            />
            <aula-metric-card [label]="tx.pauses" [value]="a.pauses" />
            <aula-metric-card
              [label]="tx.longestRun"
              [value]="i18n.fmt(tx.seconds, { n: a.longestRunS })"
            />
            <aula-metric-card [label]="tx.wordsProduced" [value]="a.wordsProduced" />
            <aula-metric-card [label]="tx.reuse" [value]="a.reuseRatio + ' %'" />
            <!-- [RF-105 · conversación sostenida]: turnos promedio por partida contra el agente (historial de partidas) -->
            <aula-metric-card
              [label]="tx.sustainedTurns"
              [value]="turns() ?? '—'"
              [hint]="tx.sustainedTurnsHint"
            />
          </div>
          <aula-trend-chart [title]="tx.trend" [values]="wpmSeries()" />
        }
      }
    </aula-card-page>
  `,
})
export default class FluencyDashboardPage {
  protected readonly i18n = inject(I18nService);
  protected readonly games = inject(GamesFacade);
  // [Orden cronológico]: el backend puede devolver la más reciente primero → se ordena por fecha
  private readonly series = computed(() =>
    [...(this.games.fluency.data() ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  );
  protected readonly wpmSeries = computed(() => this.series().map((m) => m.wordsPerMinute));
  protected readonly avg = computed(() => {
    const m = this.series();
    if (!m.length) return null;
    const mean = (k: keyof FluencyMetric) =>
      Math.round((m.reduce((s, x) => s + Number(x[k]), 0) / m.length) * 10) / 10;
    return {
      timeToRespondS: mean('timeToRespondS'),
      speakingTimeS: mean('speakingTimeS'),
      pauses: mean('pauses'),
      longestRunS: mean('longestRunS'),
      wordsProduced: mean('wordsProduced'),
      reuseRatio: Math.round(mean('reuseRatio') * 100),
    };
  });

  // [turns]: promedio de rondas de las partidas contra el agente con al menos un turno (null = aún no hay) | [Paradigma]: función pura sobre el historial
  protected readonly turns = computed(() => {
    const talks = (this.games.history.data() ?? []).filter(
      (s) => GAME_INFO[s.gameType].family === 'agent' && s.roundsCount > 0,
    );
    return talks.length
      ? Math.round((talks.reduce((n, s) => n + s.roundsCount, 0) / talks.length) * 10) / 10
      : null;
  });

  constructor() {
    void this.games.loadFluency();
    void this.games.loadHistory();
  }

  protected clear(): void {
    if (confirm(this.i18n.t().games.confirmClear)) void this.games.clearFluency();
  }
}
