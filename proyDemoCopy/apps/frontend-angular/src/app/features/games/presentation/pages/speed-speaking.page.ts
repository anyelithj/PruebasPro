import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import {
  VoiceRecorderComponent,
  type Recording,
} from '@shared/ui/organisms/voice-recorder/voice-recorder.component';
import { GamesFacade } from '../../application/games.facade';
import { SpeechFacade } from '../../application/speech.facade';
import type { FluencyMetric } from '../../domain/models/games';
import { GameShellComponent } from '../components/game-shell.component';
import { OralRoundResultComponent } from '../components/oral-round-result.component';
import { PromptCardComponent } from '../components/prompt-card.component';
// [SpeedSpeakingPage · Presentación · Sprint 8.9]: /juegos/speed-speaking — hablar 30 s, luego 60 y luego 90 sobre el mismo tema (RF-102); cada nivel es una ronda con su métrica | [Patrón]: State Machine (nivel 1 → 2 → 3 → fin) + Pipeline de voz | [Principio]: SRP + DIP | [Paradigma]: Declarativo + Reactivo
// [A11y]: el nivel y el tiempo máximo se dicen en texto; la grabadora corta sola al llegar al máximo

const LEVELS = [30, 60, 90] as const; // Segundos por nivel

@Component({
  selector: 'aula-speed-speaking-page',
  imports: [IconComponent, 
    GameShellComponent,
    PromptCardComponent,
    VoiceRecorderComponent,
    OralRoundResultComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().games;
    @let gl = games.session()?.language ?? 'en';
    <aula-game-shell
      [type]="'speed_speaking'"
      [lang]="lang()"
      [lvl]="level()"
      [diff]="d()"
      (started)="reset()"
    >
      <div class="space-y-4">
        <ol class="flex gap-2" [attr.aria-label]="tx.names.speed_speaking">
          @for (s of levels; track s; let i = $index) {
            <li
              class="badge"
              [class]="
                i < step()
                  ? 'bg-tone-brand-soft text-tone-brand'
                  : i === step()
                    ? 'bg-gradient-brand text-white'
                    : 'bg-muted text-muted-foreground'
              "
              [attr.aria-current]="i === step() ? 'step' : null"
            >
              {{ i < step() ? '✓ ' : '' }}{{ i18n.fmt(tx.speedLevel, { s }) }}
            </li>
          }
        </ol>
        <aula-prompt-card emoji="⏱️" [text]="topic()" [language]="gl" [caption]="tx.topic" />
        @if (step() < levels.length) {
          <aula-voice-recorder
            [labels]="recLabels()"
            [maxSeconds]="levels[step()]"
            [disabled]="speech.transcribing()"
            (recorded)="spoken($event)"
          />
        } @else {
          <p
            role="status"
            class="rounded-lg bg-tone-brand-soft px-3 py-2 font-semibold text-tone-brand"
          >
            <aula-icon name="trophy" /> {{ tx.speedDone }}
          </p>
          <button type="button" class="btn btn-primary" (click)="games.finish()">
            {{ tx.finish }}
          </button>
        }
        @if (speech.transcribing()) {
          <p role="status" class="text-sm text-muted-foreground">{{ tx.transcribing }}</p>
        }
        @if (speech.error(); as err) {
          <p role="alert" class="text-sm text-tone-danger">{{ err }}</p>
        }
        @if (metric()) {
          <aula-oral-round-result
            [text]="speech.transcript()?.text ?? ''"
            [language]="gl"
            [metric]="metric()"
          />
        }
      </div>
    </aula-game-shell>
  `,
})
export default class SpeedSpeakingPage {
  protected readonly i18n = inject(I18nService);
  protected readonly games = inject(GamesFacade);
  protected readonly speech = inject(SpeechFacade);
  readonly lang = input<string>();
  readonly level = input<string>();
  readonly d = input<string>();
  protected readonly levels = LEVELS;
  protected readonly step = signal(0);
  protected readonly metric = signal<FluencyMetric | null>(null);
  protected readonly topic = computed(() => this.games.session()?.content.topic ?? '');
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
    this.step.set(0);
    this.metric.set(null);
    this.speech.reset();
  }

  protected async spoken(rec: Recording): Promise<void> {
    const r = await this.speech.submitOral(rec, {
      prompt: `${LEVELS[this.step()]} s · ${this.topic()}`,
    });
    if (!r) return;
    this.metric.set(r.metric);
    this.step.update((s) => s + 1); // Sube de nivel aunque haya hablado menos: la métrica lo refleja
  }
}
