import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import {
  VoiceRecorderComponent,
  type Recording,
} from '@shared/ui/organisms/voice-recorder/voice-recorder.component';
import { GameAgentFacade, type ChatTurn } from '../../application/game-agent.facade';
import { GamesFacade } from '../../application/games.facade';
import { SpeechFacade } from '../../application/speech.facade';
import type { Objective } from '../../domain/models/games';
import { ChatTurnsComponent } from './chat-turns.component';
import { TurnTimerComponent } from './turn-timer.component';
// [ConversationPanelComponent · Presentación · Sprint 8.9]: conversación con el agente con objetivos visibles (role-play), cuenta regresiva opcional (debate, historia) y entrada por texto o voz (tabú) | [Patrón]: Composite (chat + objetivos + entrada) + Facade (GameAgentFacade / SpeechFacade) | [Principio]: DRY (7 juegos contra el agente comparten el panel) + SRP | [Paradigma]: Declarativo + Reactivo
// [A11y]: objetivos con estado en texto («Cumplido» / «Pendiente») además del icono, campo con etiqueta, Ctrl+Enter envía · [Responsive]: objetivos arriba en móvil, a la derecha desde lg

@Component({
  selector: 'aula-conversation-panel',
  imports: [IconComponent, ChatTurnsComponent, TurnTimerComponent, VoiceRecorderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }, // Elemento anfitrión en bloque → respeta márgenes y space-y del contenedor
  template: `
    @let tx = i18n.t().games;
    <div [class]="objectives().length ? 'grid gap-4 lg:grid-cols-[1fr_16rem]' : 'grid gap-4'">
      <div class="space-y-3">
        <aula-chat-turns
          [turns]="agent.turns()"
          [thinking]="agent.thinking() || speech.transcribing()"
          [language]="language()"
          [youLabel]="tx.you"
          [agentLabel]="tx.agent"
          [violationLabel]="tx.violation"
          [solvedLabel]="tx.solved"
          [thinkingLabel]="speech.transcribing() ? tx.transcribing : tx.thinking"
          [noteFor]="noteFor"
        />
        @if (agent.error() || speech.error(); as err) {
          <p role="alert" class="text-sm text-tone-danger">{{ err }}</p>
        }
        @if (agent.finished()) {
          <p
            role="status"
            class="rounded-lg bg-tone-brand-soft px-3 py-2 text-sm font-semibold text-tone-brand"
          >
            <aula-icon name="flag" /> {{ tx.gameOver }}
          </p>
        } @else {
          <form class="space-y-2" (submit)="$event.preventDefault(); send()">
            <label class="block text-sm font-semibold" for="agent-message">{{
              tx.yourAnswer
            }}</label>
            <div class="flex flex-wrap items-start gap-2">
              <textarea
                id="agent-message"
                class="control min-w-0 flex-1"
                rows="2"
                [attr.lang]="language()"
                [value]="draft()"
                (input)="draft.set($any($event.target).value)"
                (keydown.control.enter)="send()"
                [disabled]="agent.thinking()"
              ></textarea>
              <div class="flex items-center gap-2">
                @if (turnSeconds()) {
                  <aula-turn-timer
                    [seconds]="turnSeconds()"
                    [turnKey]="agent.turns().length"
                    [running]="!agent.thinking()"
                  />
                }
                <button
                  type="submit"
                  class="btn btn-primary"
                  [disabled]="!draft().trim() || agent.thinking()"
                >
                  {{ tx.send }}
                </button>
              </div>
            </div>
            @if (voice()) {
              <aula-voice-recorder
                [labels]="recLabels()"
                [maxSeconds]="60"
                [disabled]="agent.thinking()"
                [language]="language()"
                (started)="draft.set('')"
                (transcript)="draft.set($event)"
                (recorded)="spoken($event)"
              />
            }
          </form>
        }
      </div>
      @if (objectives().length) {
        <aside class="surface h-fit space-y-3 p-4" [attr.aria-label]="tx.objectives">
          <h3 class="text-sm font-bold">{{ tx.objectives }}</h3>
          <ul class="space-y-2">
            @for (o of objectives(); track o.id) {
              @let done = agent.met().includes(o.id);
              <li class="flex items-start gap-2 text-sm">
                <aula-icon [name]="done ? 'circle-check' : 'square'" />
                <span>
                  {{ o.text }}
                  <span
                    class="block text-xs font-semibold"
                    [class]="done ? 'text-tone-brand' : 'text-muted-foreground'"
                    >{{ done ? tx.objectiveMet : tx.objectivePending }}</span
                  >
                </span>
              </li>
            }
          </ul>
          <ng-content select="[panelExtra]" />
        </aside>
      }
    </div>
  `,
})
export class ConversationPanelComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly agent = inject(GameAgentFacade);
  protected readonly speech = inject(SpeechFacade);
  private readonly games = inject(GamesFacade);
  readonly objectives = input<Objective[]>([]);
  readonly voice = input(false); // Tabú: también se puede hablar
  readonly turnSeconds = input(0); // 0 = sin cuenta regresiva
  protected readonly draft = signal('');
  protected readonly language = computed(() => this.games.session()?.language ?? 'en');
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

  // [noteFor]: traduce las pistas del motor (palabra obligatoria, preguntas restantes, conectores, pista) | función flecha → conserva `this`
  protected readonly noteFor = (turn: ChatTurn): string => {
    const t = this.i18n.t().games;
    const s = turn.state ?? {};
    if (typeof s['next_word'] === 'string')
      return this.i18n.fmt(t.nextWord, { word: s['next_word'] });
    if (typeof s['required'] === 'string')
      return this.i18n.fmt(t.nextWord, { word: s['required'] });
    if (typeof s['questions_left'] === 'number')
      return this.i18n.fmt(t.questionsLeft, { n: s['questions_left'] });
    if (Array.isArray(s['connectors']) && s['connectors'].length)
      return this.i18n.fmt(t.connectors, { list: s['connectors'].join(', ') });
    if (typeof s['hint'] === 'string' && s['hint'])
      return this.i18n.fmt(t.hint, { hint: s['hint'] });
    return '';
  };

  protected async send(): Promise<void> {
    if (await this.agent.send(this.draft())) this.draft.set('');
  }

  // [spoken · 2026-10-23]: voz → texto (faster-whisper; si no responde, el dictado en vivo) → al CAMPO para que el alumno vea sus errores, corrija y envíe
  protected async spoken(rec: Recording): Promise<void> {
    const text = await this.speech.toText(rec, this.language());
    this.draft.set(text || rec.liveText || this.draft());
  }
}
