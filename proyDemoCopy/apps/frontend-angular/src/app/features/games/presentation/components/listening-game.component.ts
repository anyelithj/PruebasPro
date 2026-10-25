import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import {
  VoiceRecorderComponent,
  type Recording,
} from '@shared/ui/organisms/voice-recorder/voice-recorder.component';
import { GamesFacade } from '../../application/games.facade';
import { SpeechFacade } from '../../application/speech.facade';
import { maskGap, type Verdict } from '../../domain/models/games';
import { AnswerTimerComponent } from './answer-timer.component';
import { AudioPlayerComponent } from './audio-player.component';
import { GameShellComponent } from './game-shell.component';
import { GapFillComponent } from './gap-fill.component';
import { PromptCardComponent } from './prompt-card.component';
// [ListeningGameComponent · Presentación · Sprint 8.10]: comprensión y fluidez con la voz del navegador — shadowing (repetir grabando), dictado parcial (palabra que falta), escucha y reformula, pregunta-respuesta rápida | [Patrón]: Strategy por modo (qué se muestra y cómo se responde) + State Machine (escuchando → respondido → siguiente) | [Principio]: DRY (cuatro juegos, un flujo) + OCP | [Paradigma]: Declarativo + Reactivo
// [Material]: frases propias del proyecto (CC BY 4.0) leídas por SpeechSynthesis → sin audio ni video con derechos de terceros (Sprint 8.17)
// [A11y]: el texto se puede ver tras responder (o siempre en shadowing y dictado), feedback en role="status", reloj de respuesta en pregunta rápida

export type ListeningMode = 'shadowing' | 'partial_dictation' | 'listen_reformulate' | 'quick_qa';

@Component({
  selector: 'aula-listening-game',
  imports: [IconComponent, 
    GameShellComponent,
    AudioPlayerComponent,
    PromptCardComponent,
    GapFillComponent,
    AnswerTimerComponent,
    VoiceRecorderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }, // Elemento anfitrión en bloque → respeta márgenes y space-y del contenedor
  template: `
    @let tx = i18n.t().games;
    <aula-game-shell
      [type]="mode()"
      [lang]="lang()"
      [lvl]="level()"
      [diff]="d()"
      (started)="reset()"
    >
      @if (line(); as l) {
        @let language = games.session()!.language;
        <div class="space-y-4">
          <aula-prompt-card [text]="shownText()" [language]="language" [caption]="caption()">
            <!-- [Respuesta rápida · 2026-10-19]: suena la frase Y la pregunta; antes solo la frase y el alumno no sabía qué dato le pedían -->
            <aula-audio-player
              [text]="mode() === 'quick_qa' && l.question ? l.text + '. ' + l.question : l.text"
              [language]="language"
              [label]="tx.listenLine"
              [slowLabel]="tx.listenSlow"
            />
          </aula-prompt-card>
          @if (mode() === 'quick_qa' && l.question) {
            <p class="rounded-xl border border-tone-brand-line bg-tone-brand-soft px-4 py-3 text-base font-bold text-tone-brand" [attr.lang]="language">
              <aula-icon name="circle-help" /> {{ l.question }}
            </p>
          }

          @if (mode() === 'shadowing') {
            <aula-voice-recorder
              [labels]="recLabels()"
              [maxSeconds]="20"
              [disabled]="speech.transcribing() || !!verdict()"
              (recorded)="repeat($event)"
            />
            @if (speech.transcribing()) {
              <p role="status" class="text-sm text-muted-foreground">{{ tx.transcribing }}</p>
            }
            @if (speech.error(); as err) {
              <p role="alert" class="text-sm text-tone-danger">{{ err }}</p>
            }
            @if (verdict(); as v) {
              <div
                role="status"
                class="rounded-lg px-3 py-2 text-sm"
                [class]="
                  v.correct
                    ? 'bg-tone-brand-soft text-tone-brand'
                    : 'bg-tone-danger-soft text-tone-danger'
                "
              >
                <b>{{ v.correct ? '✓ ' + tx.correct : '✗ ' + tx.wrong }}</b> ·
                {{ i18n.fmt(tx.overlap, { pct: pct(v) }) }}
                @if (speech.transcript(); as t) {
                  <span class="block text-foreground"
                    >{{ tx.youSaid }}: «<span [attr.lang]="language">{{ t.text }}</span
                    >»</span
                  >
                }
              </div>
              <button type="button" class="btn btn-outline" (click)="next()">
                {{ tx.next }} →
              </button>
            }
          } @else {
            @if (mode() === 'quick_qa' && !verdict()) {
              <aula-answer-timer [startedAt]="shownAt()" />
            }
            <aula-gap-fill
              [label]="fieldLabel()"
              [language]="language"
              [multiline]="mode() === 'listen_reformulate'"
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
          }
        </div>
      }
    </aula-game-shell>
  `,
})
export class ListeningGameComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly games = inject(GamesFacade);
  protected readonly speech = inject(SpeechFacade);
  readonly mode = input.required<ListeningMode>();
  readonly lang = input<string>();
  readonly level = input<string>();
  readonly d = input<string>();

  protected readonly index = signal(0); // Frase actual
  protected readonly verdict = signal<Verdict | null>(null);
  protected readonly shownAt = signal(Date.now()); // Para el tiempo hasta responder
  protected readonly lines = computed(() => this.games.session()?.content.lines ?? []);
  protected readonly line = computed(() => this.lines()[this.index()] ?? null);
  // [shownText]: dictado → frase con hueco · shadowing → frase completa · reformula / pregunta rápida → oculta hasta responder
  protected readonly shownText = computed(() => {
    const l = this.line();
    if (!l) return '';
    if (this.mode() === 'partial_dictation') return this.verdict() ? l.text : maskGap(l);
    if (this.mode() === 'shadowing' || this.verdict()) return l.text;
    return '🎧';
  });
  protected readonly caption = computed(() => `${this.index() + 1} / ${this.lines().length}`);
  protected readonly fieldLabel = computed(() => {
    const t = this.i18n.t().games;
    return {
      partial_dictation: t.typeGap,
      listen_reformulate: t.reformulate,
      quick_qa: t.keyAnswer,
      shadowing: t.repeatLine,
    }[this.mode()];
  });
  protected readonly recLabels = computed(() => {
    const t = this.i18n.t().games;
    return {
      start: t.record,
      stop: t.stop,
      recording: t.recording,
      ready: t.recorded,
      denied: t.micDenied,
    };
  });

  protected reset(): void {
    this.index.set(0);
    this.verdict.set(null);
    this.speech.reset();
    this.shownAt.set(Date.now());
  }

  protected pct(v: Verdict): number {
    return Math.round((v.overlap ?? 0) * 100);
  }

  protected async answer(text: string): Promise<void> {
    const r = await this.games.answer({
      answer: text,
      lineIndex: this.index(),
      prompt: this.line()?.text,
      timeToAnswerMs: Date.now() - this.shownAt(),
    });
    if (r) this.verdict.set(r.verdict);
  }

  protected async repeat(rec: Recording): Promise<void> {
    const r = await this.speech.submitOral(rec, {
      lineIndex: this.index(),
      prompt: this.line()?.text,
    });
    if (r) this.verdict.set(r.verdict);
  }

  // [next]: siguiente frase; tras la última se termina la partida (puntaje en NestJS)
  protected next(): void {
    if (this.index() + 1 >= this.lines().length) {
      void this.games.finish();
      return;
    }
    this.index.update((i) => i + 1);
    this.verdict.set(null);
    this.speech.reset();
    this.shownAt.set(Date.now());
  }
}
