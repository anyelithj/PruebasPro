import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import { GamesFacade } from '../../application/games.facade';
import { GameShellComponent } from '../components/game-shell.component';
import { MemoryBoardComponent } from '../components/memory-board.component';
// [MemoryPage · Presentación · Sprint 8.8]: /juegos/memory — parejas palabra ↔ imagen (emoji) o traducción; cada intento es una ronda | [Patrón]: Container (smart) + Presentational (MemoryBoard) | [Principio]: SRP + DIP (fachada) | [Paradigma]: Declarativo + Reactivo
// [Ronda]: pareja correcta → `answer = término` con `expected: 'term'` (NestJS confirma) · fallo → texto «a ≠ b» (incorrecta) · al completar el tablero termina la partida

@Component({
  selector: 'aula-memory-page',
  imports: [GameShellComponent, MemoryBoardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().games;
    <aula-game-shell [type]="'memory'" [lang]="lang()" [lvl]="level()" [diff]="d()">
      <aula-memory-board
        [items]="items()"
        [language]="games.session()?.language ?? 'en'"
        [faceDownText]="tx.flipCard"
        [pairsLeftText]="tx.pairsLeft"
        (attempt)="
          games.answer({ answer: $event.answer, entryIndex: $event.pair, expected: 'term' })
        "
        (completed)="games.finish()"
      />
    </aula-game-shell>
  `,
})
export default class MemoryPage {
  protected readonly i18n = inject(I18nService);
  protected readonly games = inject(GamesFacade);
  readonly lang = input<string>();
  readonly level = input<string>();
  readonly d = input<string>();
  protected readonly items = computed(() => this.games.session()?.content.vocabulary ?? []);
}
