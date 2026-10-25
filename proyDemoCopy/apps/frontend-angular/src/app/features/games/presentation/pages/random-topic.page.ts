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
// [RandomTopicPage · Presentación · Sprint 8.9]: /juegos/tema — hablar hasta un minuto sobre un tema sorpresa; se transcribe (faster-whisper) y se miden palabras por minuto, pausas, tramo continuo y vocabulario reutilizado | [Patrón]: Container (smart) + Pipeline (grabar → transcribir → ronda → métrica) | [Principio]: SRP + DIP | [Paradigma]: Declarativo + Reactivo
// [Fluidez, no acierto]: la ronda es abierta (correct = null); lo que cuenta son las métricas (RF-102, RF-105)

@Component({
  selector: 'aula-random-topic-page',
  imports: [
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
      [type]="'random_topic'"
      [lang]="lang()"
      [lvl]="level()"
      [diff]="d()"
      (started)="metric.set(null)"
    >
      <div class="space-y-4">
        <aula-prompt-card emoji="🎲" [text]="topic()" [language]="gl" [caption]="tx.topic" />
        <aula-voice-recorder
          [labels]="recLabels()"
          [maxSeconds]="60"
          [disabled]="speech.transcribing()"
          (recorded)="spoken($event)"
        />
        @if (speech.transcribing()) {
          <p role="status" class="text-sm text-muted-foreground">{{ tx.transcribing }}</p>
        }
        @if (speech.error(); as err) {
          <p role="alert" class="text-sm text-tone-danger">{{ err }}</p>
        }
        @if (metric() || speech.transcript()) {
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
export default class RandomTopicPage {
  protected readonly i18n = inject(I18nService);
  protected readonly games = inject(GamesFacade);
  protected readonly speech = inject(SpeechFacade);
  readonly lang = input<string>();
  readonly level = input<string>();
  readonly d = input<string>();
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

  protected async spoken(rec: Recording): Promise<void> {
    const r = await this.speech.submitOral(rec, { prompt: this.topic() });
    this.metric.set(r?.metric ?? null);
  }
}
