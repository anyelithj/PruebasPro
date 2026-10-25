import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { SpeechSynthesisService } from '@core/audio/speech-synthesis.service';
import { I18nService } from '@core/i18n/i18n.service';
import { GamesFacade } from '../../application/games.facade';
import type { Verdict } from '../../domain/models/games';
import { AnswerTimerComponent } from '../components/answer-timer.component';
import { AudioPlayerComponent } from '../components/audio-player.component';
import { GameShellComponent } from '../components/game-shell.component';
import { GapFillComponent } from '../components/gap-fill.component';
import { PromptCardComponent } from '../components/prompt-card.component';
// [RecoveryDrillsPage · Presentación · Sprint 8.10]: /juegos/recuperacion — recuperación rápida de vocabulario: imagen → palabra, audio → palabra y traducción inversa, midiendo el tiempo hasta responder | [Patrón]: Strategy (modo de estímulo) + State Machine | [Principio]: SRP + DIP | [Paradigma]: Declarativo + Reactivo
// [Objetivo]: pasar de «conozco la palabra» a «me sale automáticamente» (RF-103) → el reloj es visible y queda guardado en cada ronda
// [Modos sin dato]: «traducción inversa» solo se ofrece si las palabras tienen traducción (tu vocabulario); el banco propio trae emoji

type DrillMode = 'image' | 'audio' | 'reverse';

@Component({
  selector: 'aula-recovery-drills-page',
  imports: [
    GameShellComponent,
    PromptCardComponent,
    AudioPlayerComponent,
    GapFillComponent,
    AnswerTimerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().games;
    @let gl = games.session()?.language ?? 'en';
    <aula-game-shell
      [type]="'recovery_drills'"
      [lang]="lang()"
      [lvl]="level()"
      [diff]="d()"
      (started)="restart()"
    >
      <fieldset gameIntro class="mb-4">
        <legend class="mb-2 text-sm font-semibold">{{ tx.mode }}</legend>
        <div class="flex flex-wrap gap-2">
          @for (m of modes; track m) {
            <button
              type="button"
              class="chip"
              [attr.aria-pressed]="mode() === m"
              (click)="mode.set(m)"
            >
              {{ tx.modes[m] }}
            </button>
          }
        </div>
      </fieldset>
      @if (item(); as it) {
        <div class="space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex flex-wrap gap-2">
              @for (m of availableModes(); track m) {
                <button
                  type="button"
                  class="chip"
                  [attr.aria-pressed]="mode() === m"
                  (click)="mode.set(m)"
                >
                  {{ tx.modes[m] }}
                </button>
              }
            </div>
            @if (!verdict()) {
              <aula-answer-timer [startedAt]="shownAt()" />
            } @else {
              <span class="text-sm font-semibold tabular-nums">{{
                i18n.fmt(tx.answerTime, { s: lastSeconds() })
              }}</span>
            }
          </div>
          @switch (mode()) {
            @case ('audio') {
              <aula-prompt-card [caption]="index() + 1 + ' / ' + total()">
                <aula-audio-player
                  [text]="it.term"
                  [language]="gl"
                  [label]="tx.listenWord"
                  [slowLabel]="tx.listenSlow"
                />
              </aula-prompt-card>
            }
            @case ('reverse') {
              <aula-prompt-card
                [text]="it.translation ?? ''"
                language="es"
                [caption]="index() + 1 + ' / ' + total()"
              />
            }
            @default {
              <aula-prompt-card
                [emoji]="it.emoji ?? '❔'"
                [emojiLabel]="it.translation ?? ''"
                [caption]="index() + 1 + ' / ' + total()"
              />
            }
          }
          <aula-gap-fill
            [label]="tx.yourAnswer"
            [language]="gl"
            [busy]="games.busy()"
            [verdict]="verdict()"
            [roundKey]="index()"
            [checkLabel]="tx.check"
            [nextLabel]="tx.next"
            [correctLabel]="tx.correct"
            [wrongLabel]="tx.wrong"
            [expectedLabel]="i18n.fmt(tx.expected, { answer: '' })"
            (answered)="answer($event)"
            (next)="next()"
          />
        </div>
      }
    </aula-game-shell>
  `,
})
export default class RecoveryDrillsPage {
  protected readonly i18n = inject(I18nService);
  protected readonly games = inject(GamesFacade);
  private readonly speech = inject(SpeechSynthesisService);
  readonly lang = input<string>();
  readonly level = input<string>();
  readonly d = input<string>();
  protected readonly modes: readonly DrillMode[] = ['image', 'audio', 'reverse'];
  protected readonly mode = signal<DrillMode>('image');
  protected readonly index = signal(0);
  protected readonly verdict = signal<Verdict | null>(null);
  protected readonly shownAt = signal(Date.now());
  protected readonly lastSeconds = signal('0');
  protected readonly items = computed(() => this.games.session()?.content.vocabulary ?? []);
  protected readonly total = computed(() => this.items().length);
  protected readonly item = computed(() => this.items()[this.index()] ?? null);
  // [availableModes]: imagen solo con emoji, inversa solo con traducción; audio siempre
  protected readonly availableModes = computed(() => {
    const it = this.items();
    return this.modes.filter((m) =>
      m === 'image'
        ? it.some((w) => w.emoji)
        : m === 'reverse'
          ? it.some((w) => w.translation)
          : true,
    );
  });

  protected restart(): void {
    this.index.set(0);
    this.verdict.set(null);
    if (!this.availableModes().includes(this.mode()))
      this.mode.set(this.availableModes()[0] ?? 'audio');
    this.show();
  }

  private show(): void {
    this.shownAt.set(Date.now());
    const it = this.item();
    if (it && this.mode() === 'audio')
      this.speech.speak(it.term, this.games.session()?.language ?? 'en');
  }

  protected async answer(text: string): Promise<void> {
    const ms = Date.now() - this.shownAt();
    this.lastSeconds.set((ms / 1000).toFixed(1));
    const r = await this.games.answer({
      answer: text,
      entryIndex: this.index(),
      expected: 'term',
      timeToAnswerMs: ms,
      prompt: this.mode(),
    });
    if (r) this.verdict.set(r.verdict);
  }

  protected next(): void {
    if (this.index() + 1 >= this.total()) {
      void this.games.finish();
      return;
    }
    this.index.update((i) => i + 1);
    this.verdict.set(null);
    this.show();
  }
}
