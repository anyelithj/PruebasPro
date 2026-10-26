import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { BackLinkComponent } from '@shared/ui/atoms/back-link/back-link.component';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  type ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CEFR_LEVELS, LANGUAGES } from '@aula/shared-schemas';
import { speechFallbackNotice } from '@core/audio/server-speech';
import { SpeechSynthesisService } from '@core/audio/speech-synthesis.service';
import { I18nService } from '@core/i18n/i18n.service';
import { AvatarStageComponent } from '@shared/ui/organisms/avatar-stage/avatar-stage.component';
import { SyncedTranscriptComponent } from '@shared/ui/organisms/synced-transcript/synced-transcript.component';
import {
  VoiceRecorderComponent,
  type Recording,
} from '@shared/ui/organisms/voice-recorder/voice-recorder.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { DialogueAgentFacade } from '../../application/dialogue-agent.facade';
import { DialoguesFacade } from '../../application/dialogues.facade';
import { toTranscript } from '../../domain/models/dialogues';
import { DialogueTopicPickerComponent } from '../components/dialogue-topic-picker.component';
// [AvatarConversationPage · Presentación · Sprint 9.12 · RF-122/RF-124]: /dialogos/conversar/:topicId — hablar (o escribir) con el avatar sobre un tema; el texto se muestra con IPA y traducción lado a lado y se resalta el turno que suena; correcciones suaves bajo el turno · /dialogos/sesion/:id — transcripción de una conversación anterior | [Patrón]: Container (smart) + Facade (DialogueAgentFacade, SSE) + State Machine (avatar) | [Principio]: SRP + DRY (AvatarStage, SyncedTranscript, VoiceRecorder) + privacidad | [Paradigma]: Declarativo + Reactivo
// [A11y]: alternativa escrita siempre visible · estado del avatar y respuesta en vivo con aria-live · aviso si el navegador no tiene voz

// [LiveRecognition]: lo mínimo de la Web Speech API que se usa (TypeScript no la declara: no es estándar en todos los navegadores)
interface LiveRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: () => void;
  start(): void;
  stop(): void;
}

@Component({
  selector: 'aula-avatar-conversation-page',
  imports: [IconComponent, 
    BackLinkComponent,
    RouterLink,
    CardPageTemplate,
    AvatarStageComponent,
    SyncedTranscriptComponent,
    VoiceRecorderComponent,
    DialogueTopicPickerComponent,
  ],
  providers: [DialogueAgentFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().dialogues;
    @let cv = tx.conversation;
    @let topic = agent.topic() ?? currentTopic();
    <aula-card-page
      [heading]="i18n.fmt(cv.title, { topic: topic ? topic.emoji + ' ' + topic.title : '…' })"
      [subtitle]="cv.privacy"
    >
      <a aulaBackLink pageBack routerLink="/dialogos">{{ tx.back }}</a>
      <div pageActions class="flex flex-wrap gap-2">
        @if (agent.session() && !agent.ended() && !id()) {
          <button type="button" class="btn btn-outline btn-sm" (click)="agent.end()">
            <aula-icon name="flag" /> {{ cv.end }}
          </button>
        }
        @if (agent.session()) {
          <button type="button" class="btn btn-danger btn-sm" (click)="remove()">
            <aula-icon name="trash-2" /> {{ cv.remove }}
          </button>
        }
      </div>

      @if (!agent.session() && !id()) {
        <!-- [Antes de empezar]: idioma y nivel (vienen de la URL del tema y se pueden cambiar) -->
        <div class="space-y-4">
          <aula-dialogue-topic-picker
            [(language)]="language"
            [(level)]="selectedLevel"
            [languageLabel]="tx.language"
            [levelLabel]="tx.level"
            [names]="names()"
          />
          @if (topic) {
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="rounded-xl border border-border p-3">
                <h2 class="mb-1 text-sm font-bold"><aula-icon name="target" /> {{ cv.objectives }}</h2>
                <ul class="list-inside list-disc text-sm text-muted-foreground">
                  @for (o of topic.objectives; track o) {
                    <li>{{ o }}</li>
                  }
                </ul>
              </div>
              <div class="rounded-xl border border-border p-3">
                <h2 class="mb-1 text-sm font-bold"><aula-icon name="key-round" /> {{ cv.vocabulary }}</h2>
                <p class="flex flex-wrap gap-1.5" [attr.lang]="language()">
                  @for (w of topic.vocabulary[language()] ?? []; track w) {
                    <span class="badge bg-muted">{{ w }}</span>
                  }
                </p>
              </div>
            </div>
          }
          <button
            type="button"
            class="btn btn-primary btn-lg"
            [disabled]="agent.busy() || !topicId()"
            (click)="start()"
          >
            <aula-icon name="message-circle" /> {{ cv.start }}
          </button>
        </div>
      } @else if (agent.session(); as s) {
        @if (agent.noVoice()) {
          <p class="mb-3 rounded-xl bg-tone-warning-soft p-3 text-sm text-tone-warning">
            <aula-icon name="triangle-alert" /> {{ i18n.t().media.noVoice }}
          </p>
        }
        <div class="grid gap-6 lg:grid-cols-[16rem_1fr]">
          <div class="space-y-3">
            <aula-avatar-stage
              [state]="agent.state()"
              [level]="agent.lipSync.level()"
              [labels]="i18n.t().media.avatar"
              [name]="cv.avatar"
            />
            @if (vocab().length) {
              <div class="rounded-xl border border-border p-3">
                <h2 class="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <aula-icon name="key-round" /> {{ cv.vocabulary }}
                </h2>
                <p class="flex flex-wrap gap-1.5 text-xs" [attr.lang]="s.language">
                  @for (w of vocab(); track w) {
                    <span
                      class="badge"
                      [class]="
                        agent.vocabularyUsed().includes(w)
                          ? 'bg-tone-brand-soft text-tone-brand'
                          : 'bg-muted'
                      "
                      >{{ agent.vocabularyUsed().includes(w) ? '✓ ' : '' }}{{ w }}</span
                    >
                  }
                </p>
              </div>
            }
          </div>
          <div class="min-w-0 space-y-4">
            <aula-synced-transcript
              [lines]="lines()"
              [language]="s.language"
              [current]="current()"
              [follow]="follow()"
              [labels]="i18n.t().media.transcript"
              (followChange)="follow.set($event)"
            />
            @if (recordings().length) {
              <!-- [2026-10-20]: grabaciones de voz guardadas de cada turno del usuario -->
              <details class="rounded-xl border border-border p-3" open>
                <summary class="cursor-pointer text-sm font-bold"><aula-icon name="mic" /> {{ cv.recordings }} ({{ recordings().length }})</summary>
                <ul class="mt-2 space-y-2">
                  @for (r of recordings(); track r.id) {
                    <li class="space-y-1">
                      <p class="text-xs text-muted-foreground" [attr.lang]="s.language">{{ r.label }}</p>
                      <audio controls preload="none" class="h-9 w-full" [src]="r.url" [attr.aria-label]="r.label"></audio>
                    </li>
                  }
                </ul>
              </details>
            }
            @if (agent.partial()) {
              <p
                class="rounded-xl bg-muted p-3 text-sm italic"
                aria-live="polite"
                [attr.lang]="s.language"
              >
                {{ cv.avatar }}: {{ agent.partial() }}
              </p>
            }
            @if (agent.ended()) {
              <p class="text-sm font-semibold text-tone-brand" role="status"><aula-icon name="party-popper" /> {{ cv.ended }}</p>
            } @else if (!id()) {
              <div class="space-y-3 rounded-xl border border-border p-3">
                <aula-voice-recorder
                  [labels]="i18n.t().media.recorder"
                  [maxSeconds]="45"
                  [disabled]="agent.busy() || agent.state() === 'speaking'"
                  (started)="listen()"
                  (recorded)="recorded($event)"
                />
                <!-- [2026-10-25 · Respaldo]: servidor sin voz a texto → aviso accionable (role="status": informa sin interrumpir) -->
                @if (speechNotice(); as notice) {
                  <p class="text-xs font-semibold text-tone-warning" role="status"><aula-icon name="info" /> {{ notice }}</p>
                }
                @if (reviewing()) {
                  <p class="text-xs font-semibold text-tone-brand" role="status"><aula-icon name="pen-line" /> {{ cv.review }}</p>
                }
                <form class="flex flex-wrap gap-2" (submit)="$event.preventDefault(); send()">
                  <input
                    #answer
                    class="control min-w-0 flex-1"
                    [class.ring-2]="reviewing()"
                    [class.ring-primary]="reviewing()"
                    maxlength="600"
                    [attr.lang]="s.language"
                    [attr.aria-label]="cv.placeholder"
                    [placeholder]="cv.placeholder"
                    [value]="draft()"
                    (input)="draft.set($any($event.target).value)"
                  />
                  <button
                    type="submit"
                    class="btn btn-primary"
                    [disabled]="!draft().trim() || agent.busy()"
                  >
                    {{ cv.send }}
                  </button>
                </form>
              </div>
            }
          </div>
        </div>
      }
      @if (agent.error()) {
        <p role="alert" class="mt-3 text-sm text-tone-danger">{{ agent.error() }}</p>
      }
    </aula-card-page>
  `,
})
export default class AvatarConversationPage {
  protected readonly i18n = inject(I18nService);
  protected readonly agent = inject(DialogueAgentFacade);
  private readonly dialogues = inject(DialoguesFacade);
  private readonly router = inject(Router);
  readonly topicId = input<string>(); // /dialogos/conversar/:topicId
  readonly id = input<string>(); // /dialogos/sesion/:id (solo lectura)
  readonly lang = input<string>(); // ?lang= del hub
  readonly level = input<string>(); // ?level= del hub
  protected readonly language = signal('en');
  protected readonly selectedLevel = signal('A2');
  protected readonly draft = signal('');
  protected readonly follow = signal(true);
  protected readonly reviewing = signal(false); // Texto dictado pendiente de revisar
  protected readonly speechNotice = signal<string | null>(null); // [2026-10-25]: aviso de respaldo si el servidor no transcribe
  private readonly answer = viewChild<ElementRef<HTMLInputElement>>('answer'); // `viewChild` (Angular 17.2+): signal con el campo de respuesta
  private readonly speech = inject(SpeechSynthesisService);
  private live: LiveRecognition | null = null;
  protected readonly names = computed(() =>
    Object.fromEntries(LANGUAGES.map((c) => [c, this.i18n.languageName(c)])),
  );
  protected readonly currentTopic = computed(
    () => this.dialogues.topics.data()?.find((t) => t.id === this.topicId()) ?? null,
  );
  protected readonly vocab = computed(() => {
    const t = this.agent.topic() ?? this.currentTopic();
    return t?.vocabulary[this.agent.session()?.language ?? this.language()] ?? [];
  });
  protected readonly lines = computed(() => {
    const cv = this.i18n.t().dialogues.conversation;
    return this.agent.turns().map((t) => toTranscript(t, { user: cv.you, avatar: cv.avatar }));
  });
  // [recordings]: turnos del usuario con grabación guardada → reproductor nativo <audio> (Range/206 desde NestJS)
  protected readonly recordings = computed(() => {
    const cv = this.i18n.t().dialogues.conversation;
    return this.agent
      .turns()
      .filter((t) => t.speaker === 'user' && t.audioKey)
      .map((t, i) => ({
        id: t.id,
        url: this.agent.recordingUrl(t.id) ?? '',
        label: this.i18n.fmt(cv.recordingOf, { n: i + 1, text: t.text.slice(0, 60) }),
      }));
  });
  // [current]: el turno que suena; si nada suena, el último
  protected readonly current = computed(
    () => this.agent.speakingIndex() ?? this.agent.turns().length - 1,
  );

  constructor() {
    effect(() => {
      const l = this.lang();
      const lv = this.level();
      untracked(() => {
        if (l && (LANGUAGES as readonly string[]).includes(l)) this.language.set(l);
        if (lv && (CEFR_LEVELS as readonly string[]).includes(lv)) this.selectedLevel.set(lv);
      });
    });
    effect(() => {
      if (this.topicId()) void this.dialogues.loadTopics({});
      const id = this.id();
      if (id) void this.agent.load(id);
    });
  }

  protected start(): void {
    void this.agent.start(this.topicId()!, this.language(), this.selectedLevel());
  }

  protected send(): void {
    this.agent.send(this.draft());
    this.draft.set('');
    this.reviewing.set(false);
  }

  // [listen · Progressive Enhancement]: mientras graba, el reconocimiento del navegador (Chrome/Edge) escribe en vivo en el campo;
  // al terminar, faster-whisper da el texto definitivo (más preciso y en el idioma de la sesión) | sin Web Speech: solo Whisper
  protected listen(): void {
    this.agent.listening();
    this.draft.set('');
    const w = window as unknown as Record<string, (new () => LiveRecognition) | undefined>;
    const Recognition = w['SpeechRecognition'] ?? w['webkitSpeechRecognition'];
    const s = this.agent.session();
    if (!Recognition || !s) return;
    const r = new Recognition();
    r.lang = this.speech.voiceLang(s.language); // BCP 47 del idioma de la conversación (en-GB/en-US según acento)
    r.interimResults = true;
    r.continuous = true;
    r.onresult = (e) =>
      this.draft.set(
        Array.from(e.results, (x) => x[0]?.transcript ?? '')
          .join(' ')
          .trim(),
      );
    r.onerror = () => undefined; // Permiso denegado o sin red → Whisper lo resuelve al terminar
    try {
      r.start();
      this.live = r;
    } catch {
      this.live = null;
    }
  }

  protected async recorded(rec: Recording): Promise<void> {
    this.live?.stop();
    this.live = null;
    // [2026-10-20]: la transcripción en vivo del navegador queda en el campo aunque Whisper falle; si Whisper responde, la reemplaza
    const text = await this.agent.transcribe(rec, this.draft());
    if (text) this.draft.set(text);
    const hasText = !!this.draft().trim();
    this.reviewing.set(hasText); // El alumno revisa y envía (no se envía solo)
    // [Respaldo · 2026-10-25]: sin voz a texto en el servidor → dictado del navegador (si lo hubo) o escribir; la grabación sigue pendiente y se guarda al enviar
    const labels = this.i18n.t().media.recorder;
    this.speechNotice.set(
      this.agent.serverSpeechDown() ? `${speechFallbackNotice(labels, hasText)} ${labels.keptOnSend}` : null,
    );
    if (this.agent.serverSpeechDown()) this.answer()?.nativeElement.focus(); // [A11y]: el foco va al campo para escribir o corregir
  }

  protected async remove(): Promise<void> {
    if (await this.agent.remove()) await this.router.navigateByUrl('/dialogos');
  }
}
