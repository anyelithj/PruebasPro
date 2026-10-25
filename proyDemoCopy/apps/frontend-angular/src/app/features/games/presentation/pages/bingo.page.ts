import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { SpeechSynthesisService } from '@core/audio/speech-synthesis.service';
import { I18nService } from '@core/i18n/i18n.service';
import { GamesFacade } from '../../application/games.facade';
import { shuffle, type GameSession } from '../../domain/models/games';
import { AudioPlayerComponent } from '../components/audio-player.component';
import { BingoBoardComponent } from '../components/bingo-board.component';
import { GameShellComponent } from '../components/game-shell.component';
// [BingoPage · Presentación · Sprint 8.8]: /juegos/bingo — la voz del navegador dice una palabra y el usuario la localiza en el tablero | [Patrón]: Container (smart) + State Machine (cantar → marcar → siguiente) | [Principio]: SRP + DIP | [Paradigma]: Declarativo + Reactivo
// [Ronda]: `answer` = casilla pulsada, `entryIndex` = palabra cantada → NestJS decide si coincide · [A11y]: la palabra cantada se puede repetir; tras fallar se muestra en texto

@Component({
  selector: 'aula-bingo-page',
  imports: [GameShellComponent, AudioPlayerComponent, BingoBoardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().games;
    @let gl = games.session()?.language ?? 'en';
    <aula-game-shell
      [type]="'bingo'"
      [lang]="lang()"
      [lvl]="level()"
      [diff]="d()"
      (started)="begin($event)"
    >
      @if (current() !== null) {
        <div
          class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-soft p-4"
        >
          <p class="text-sm font-semibold">{{ tx.findWord }}</p>
          <aula-audio-player
            [text]="items()[current()!].term"
            [language]="gl"
            [label]="tx.listenWord"
            [slowLabel]="tx.listenSlow"
          />
        </div>
      }
      @if (feedback(); as f) {
        <p
          role="status"
          class="mb-3 rounded-lg px-3 py-2 text-sm font-semibold"
          [class]="
            f.ok ? 'bg-tone-brand-soft text-tone-brand' : 'bg-tone-danger-soft text-tone-danger'
          "
        >
          {{ f.ok ? '✓ ' + tx.correct : '✗ ' + i18n.fmt(tx.expected, { answer: f.word }) }}
        </p>
      }
      <aula-bingo-board
        [items]="items()"
        [marked]="marked()"
        [disabled]="games.busy() || current() === null"
        [language]="gl"
        [label]="tx.findWord"
        (pick)="pick($event)"
      />
    </aula-game-shell>
  `,
})
export default class BingoPage {
  protected readonly i18n = inject(I18nService);
  protected readonly games = inject(GamesFacade);
  private readonly speech = inject(SpeechSynthesisService);
  readonly lang = input<string>();
  readonly level = input<string>();
  readonly d = input<string>();
  protected readonly items = computed(() => this.games.session()?.content.vocabulary ?? []);
  protected readonly marked = signal<number[]>([]);
  protected readonly feedback = signal<{ ok: boolean; word: string } | null>(null);
  private queue: number[] = []; // Orden en que se «cantan» las palabras
  protected readonly current = signal<number | null>(null);

  protected begin(s: GameSession): void {
    this.queue = shuffle(s.content.vocabulary.map((_, i) => i));
    this.marked.set([]);
    this.feedback.set(null);
    this.call();
  }

  // [call]: canta la siguiente palabra (o termina)
  private call(): void {
    const next = this.queue.shift();
    if (next === undefined) {
      this.current.set(null);
      void this.games.finish();
      return;
    }
    this.current.set(next);
    this.speech.speak(this.items()[next].term, this.games.session()?.language ?? 'en');
  }

  protected async pick(index: number): Promise<void> {
    const called = this.current();
    if (called === null) return;
    const r = await this.games.answer({
      answer: this.items()[index].term,
      entryIndex: called,
      expected: 'term',
    });
    if (!r) return;
    this.feedback.set({ ok: !!r.verdict.correct, word: this.items()[called].term });
    this.marked.update((m) => [...m, called]); // La palabra cantada queda marcada (acierte o no) → se ve dónde estaba
    this.call();
  }
}
