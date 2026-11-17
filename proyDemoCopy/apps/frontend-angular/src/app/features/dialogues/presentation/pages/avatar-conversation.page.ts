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
import { liveDictationSupported } from '@core/audio/server-speech';
import { markWords, realCorrection, splitCorrection, toTranscript } from '../../domain/models/dialogues';
import { markWhy, RIGHT_CLS, WRONG_CLS } from '@shared/ui/organisms/synced-transcript/transcript-line.model';
import { DialogueTopicPickerComponent } from '../components/dialogue-topic-picker.component';
import { OwnLlmRepository } from '@features/own-llm/domain/own-llm.repository.port';
import { OwnLlmHttpRepository } from '@features/own-llm/infrastructure/own-llm.http-repository';
import { WRITING_LANGUAGES, type CorrectorResult } from '@features/own-llm/domain/models/own-llm';
import { CorrectionErrorsComponent } from '@features/own-llm/presentation/components/correction-errors.component';
// [AvatarConversationPage · Presentación · Sprint 9.12 · RF-122/RF-124]: /dialogos/conversar/:topicId — hablar (o escribir) con el avatar sobre un tema; el texto se muestra con IPA y traducción lado a lado y se resalta el turno que suena; correcciones suaves bajo el turno · /dialogos/sesion/:id — transcripción de una conversación anterior | [Patrón]: Container (smart) + Facade (DialogueAgentFacade, SSE) + State Machine (avatar) | [Principio]: SRP + DRY (AvatarStage, SyncedTranscript, VoiceRecorder) + privacidad | [Paradigma]: Declarativo + Reactivo
// [A11y]: alternativa escrita siempre visible · estado del avatar y respuesta en vivo con aria-live · aviso si el navegador no tiene voz

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
    CorrectionErrorsComponent,
  ],
  providers: [DialogueAgentFacade, { provide: OwnLlmRepository, useClass: OwnLlmHttpRepository }], // [2026-11-06]: corrector de redacción reutilizado para revisar ANTES de enviar
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
                <h2 class="title-section mb-1"><aula-icon name="target" /> {{ cv.objectives }}</h2>
                <ul class="list-inside list-disc text-muted-foreground">
                  @for (o of topic.objectives; track o) {
                    <li>{{ o }}</li>
                  }
                </ul>
              </div>
              <div class="rounded-xl border border-border p-3">
                <h2 class="title-section mb-1"><aula-icon name="key-round" /> {{ cv.vocabulary }}</h2>
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
          <p class="mb-3 rounded-xl bg-tone-warning-soft p-3 text-tone-warning">
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
                <h2 class="title-overline mb-1 text-muted-foreground">
                  <aula-icon name="key-round" /> {{ cv.vocabulary }}
                </h2>
                <p class="flex flex-wrap gap-1.5 type-meta" [attr.lang]="s.language">
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
                      <p class="type-meta text-muted-foreground" [attr.lang]="s.language">{{ r.label }}</p>
                      <audio controls preload="none" class="h-9 w-full" [src]="r.url" [attr.aria-label]="r.label"></audio>
                    </li>
                  }
                </ul>
              </details>
            }
            @if (agent.partial()) {
              <p
                class="rounded-xl bg-muted p-3 italic"
                aria-live="polite"
                [attr.lang]="s.language"
              >
                {{ cv.avatar }}: {{ agent.partial() }}
              </p>
            }
            @if (agent.ended()) {
              <p class="font-semibold text-tone-brand" role="status"><aula-icon name="party-popper" /> {{ cv.ended }}</p>
            } @else if (!id()) {
              <div class="space-y-3 rounded-xl border border-border p-3">
                <aula-voice-recorder
                  [labels]="i18n.t().media.recorder"
                  [maxSeconds]="45"
                  [disabled]="agent.busy() || agent.state() === 'speaking'"
                  [language]="s.language"
                  (started)="listen()"
                  (transcript)="draft.set($event)"
                  (recorded)="recorded($event)"
                />
                <!-- [2026-11-05 · Corrector]: tras cada respuesta, la corrección suave del avatar o la confirmación de que estaba bien (sustituye a los avisos técnicos del reconocimiento de voz) -->
                @if (lastUserTurn(); as u) {
                  <!-- [2026-11-13 · Anexo A]: veredicto, puntuación, frase corregida, traducción y errores salen del MISMO JSON del corrector único
                       → nunca «100 %» ni «Tu frase es correcta» si hay errores (antes el % se calculaba aparte por similitud de palabras) -->
                  @if (u.feedback; as fb) {
                    @let c = fb.correccion;
                    <div class="space-y-1.5 rounded-lg p-3 text-sm" role="status" [class]="c.veredicto === 'correcta' ? 'bg-tone-success-soft' : 'bg-tone-warning-soft'">
                      <p class="flex flex-wrap items-center gap-3 font-semibold">
                        <span class="text-xl font-extrabold tabular-nums" [class.text-tone-success]="fb.puntuacion === 100" [class.text-tone-danger]="fb.puntuacion < 70">{{ fb.puntuacion }} %</span>
                        <span [class.text-tone-success]="c.veredicto === 'correcta'">
                          <aula-icon [name]="c.veredicto === 'correcta' ? 'check' : 'pen-line'" />
                          {{ c.veredicto === 'correcta' ? cv.feedbackOk : c.veredicto === 'no_responde' ? cv.feedbackNoAnswer : cv.feedbackMean }}
                        </span>
                        <span class="type-meta rounded bg-muted px-1.5 py-0.5 font-semibold">{{ cv.feedbackKind }}</span>
                      </p>
                      @if (c.veredicto === 'con_errores') {
                        <p [attr.lang]="s.language" class="leading-relaxed">
                          <span class="type-meta font-semibold text-muted-foreground">{{ cv.feedbackYou }} </span>
                          @for (w of markWords(u.text, c.frase_corregida); track $index) {<span [class]="w.ok === false ? wrongCls : ''">{{ w.text }}</span>}
                        </p>
                        <p [attr.lang]="s.language" class="text-base leading-relaxed">
                          <span class="type-meta font-semibold text-muted-foreground">{{ cv.feedbackBetter }} </span>
                          @for (w of markWords(c.frase_corregida, u.text); track $index) {<span [class]="w.ok === false ? rightCls : ''">{{ w.text }}</span>}
                        </p>
                        <aula-correction-errors [errors]="c.errores" [language]="s.language" />
                      } @else {
                        <p [attr.lang]="s.language" [class.text-tone-success]="c.veredicto === 'correcta'">«{{ u.text }}»</p>
                      }
                      <!-- Traducción de la frase CORREGIDA (nunca de la que tiene errores: «niece» ≠ «prima/nieta») -->
                      @if (c.traduccion) {
                        <p lang="es" class="text-muted-foreground">{{ c.traduccion }}</p>
                      }
                      @if (c.comentario) {
                        <p lang="es"><aula-icon name="info" /> {{ c.comentario }}</p>
                      }
                    </div>
                  } @else if (u.correction) {
                    <!-- [Histórico]: turnos anteriores al 2026-11-13 (corrección en texto, sin veredicto ni puntuación) -->
                    @let fix = splitCorrection(u.correction);
                    <div class="space-y-1.5 rounded-lg bg-tone-warning-soft p-3 text-sm" role="status">
                      @if (fix.corrected) {
                        <p [attr.lang]="s.language"><span class="type-meta font-semibold text-muted-foreground">{{ cv.feedbackBetter }} </span>{{ fix.corrected }}</p>
                      }
                      @if (fix.why) {
                        <p lang="es"><aula-icon name="info" /> {{ fix.why }}</p>
                      }
                    </div>
                  }
                }
                <!-- [2026-11-09 · Restaurado]: sin texto transcrito (servidor de voz caído y sin dictado del navegador) → aviso accionable para escribir -->
                @if (speechNotice(); as notice) {
                  <p class="type-meta font-semibold text-tone-warning" role="status"><aula-icon name="info" /> {{ notice }}</p>
                }
                @if (reviewing()) {
                  <p class="type-meta font-semibold text-tone-brand" role="status"><aula-icon name="pen-line" /> {{ cv.review }}</p>
                }
                <!-- [2026-11-06 → 2026-11-13]: revisión del borrador ANTES de enviar con el MISMO corrector que puntuará el turno (Anexo A) -->
                @if (precheckBusy() || precheck()) {
                  <div class="space-y-1.5 rounded-lg border border-border bg-muted/40 p-3 text-sm" aria-live="polite">
                    <p class="type-meta font-semibold uppercase tracking-wide text-muted-foreground">{{ cv.precheckTitle }}</p>
                    @if (precheckBusy()) {
                      <p class="animate-pulse text-muted-foreground">{{ cv.precheckBusy }}</p>
                    } @else if (precheck(); as pc) {
                      @let c = pc.correccion;
                      @if (c.veredicto === 'correcta') {
                        <p class="font-semibold text-tone-success"><aula-icon name="check" /> {{ cv.precheckOk }}</p>
                      } @else {
                        <p class="font-semibold">{{ c.veredicto === 'no_responde' ? cv.feedbackNoAnswer : i18n.fmt(cv.precheckFound, { n: c.errores.length }) }}</p>
                        <p [attr.lang]="s.language" class="leading-relaxed">
                          <span class="type-meta font-semibold text-muted-foreground">{{ cv.feedbackYou }} </span>
                          @for (w of markWords(draft(), c.frase_corregida); track $index) {<span [class]="w.ok === false ? wrongCls : ''">{{ w.text }}</span>}
                        </p>
                        <p [attr.lang]="s.language" class="text-base leading-relaxed">
                          <span class="type-meta font-semibold text-muted-foreground">{{ cv.feedbackBetter }} </span>
                          @for (w of markWords(c.frase_corregida, draft()); track $index) {<span [class]="w.ok === false ? rightCls : ''">{{ w.text }}</span>}
                        </p>
                        @if (c.traduccion) {
                          <p lang="es" class="text-muted-foreground">{{ c.traduccion }}</p>
                        }
                        <aula-correction-errors [errors]="c.errores" [language]="s.language" />
                        <button type="button" class="btn btn-outline btn-sm" (click)="draft.set(c.frase_corregida)"><aula-icon name="pen-line" /> {{ cv.precheckUse }}</button>
                      }
                    }
                  </div>
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
        <p role="alert" class="mt-3 text-tone-danger">{{ agent.error() }}</p>
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
  protected readonly speechNotice = signal<string | null>(null);
  protected readonly follow = signal(true);
  protected readonly reviewing = signal(false); // Texto dictado pendiente de revisar
  // [lastUserTurn]: última respuesta del alumno → su corrección o «bien dicho»
  protected readonly markWords = markWords;
  protected readonly markWhy = markWhy;
  protected readonly wrongCls = WRONG_CLS; // Rojo tachado = lo que está mal
  protected readonly rightCls = RIGHT_CLS; // Verde = lo correcto
  protected readonly splitCorrection = splitCorrection;
  // [2026-11-13 · Anexo A «origen»]: el borrador vino del dictado → el corrector trata las palabras sin sentido como posible error de dictado
  protected readonly spoken = signal(false);
  protected readonly lastUserTurn = computed(() => {
    const t = [...this.agent.turns()].reverse().find((x) => x.speaker === 'user');
    return t ? { ...t, correction: realCorrection(t.text, t.correction) } : null; // [2026-11-09]: sin correcciones vacías
  });
  private readonly answer = viewChild<ElementRef<HTMLInputElement>>('answer'); // `viewChild` (Angular 17.2+): signal con el campo de respuesta
  private readonly speech = inject(SpeechSynthesisService);
  private readonly corrector = inject(OwnLlmRepository);
  // [precheck · 2026-11-06]: revisión del borrador ANTES de enviar | debounce 1 s + `gen` (Generation Token): una respuesta de un texto viejo se ignora | fallo → sin panel (Fail Soft: se puede enviar igual)
  protected readonly precheck = signal<CorrectorResult | null>(null);
  protected readonly precheckBusy = signal(false);
  private precheckGen = 0;
  private readonly precheckDraft = effect((onCleanup) => {
    const text = this.draft().trim();
    const s = this.agent.session();
    const mine = ++this.precheckGen;
    untracked(() => {
      this.precheck.set(null);
      this.precheckBusy.set(false);
    });
    // [2026-11-06 · Lentitud]: la IA atiende UNA petición a la vez → la revisión no se lanza con el avatar ocupado, espera 2 s sin teclear
    // y se CANCELA al cambiar el texto o enviar (antes se encolaban revisiones viejas delante de la respuesta del avatar: ~2 min)
    if (!s || this.agent.ended() || this.agent.busy() || text.split(/\s+/).length < 3 || text.length > 600) return;
    if (!(WRITING_LANGUAGES as readonly string[]).includes(s.language)) return;
    let sub: { unsubscribe(): void } | null = null;
    const timer = setTimeout(() => {
      this.precheckBusy.set(true);
      // [2026-11-11]: con la última frase del avatar → la revisión entiende a qué responde («my niece is Laura» ante «What's your name?»)
      const asked = [...untracked(this.agent.turns)].reverse().find((t) => t.speaker !== 'user')?.text.slice(0, 400);
      // [2026-11-13 · Anexo A]: MISMO corrector (y entrada) que puntuará el turno al enviarlo → lo que ves aquí es lo que se evaluará
      const input = { pregunta_previa: asked ?? '', texto: text, idioma: s.language, nivel: s.level, tema: untracked(this.agent.topic)?.title ?? '', origen: untracked(this.spoken) ? 'voz' : 'escrito' } as const;
      sub = this.corrector.correctSentence(input).subscribe({
        next: (r) => {
          if (mine !== this.precheckGen) return;
          this.precheckBusy.set(false);
          this.precheck.set(r);
        },
        error: () => mine === this.precheckGen && this.precheckBusy.set(false),
      });
    }, 2000);
    onCleanup(() => {
      clearTimeout(timer);
      sub?.unsubscribe(); // Cancela la petición HTTP en curso
    });
  });
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
    // [2026-11-06 · «no es claro para qué está este mensaje»]: la nota bajo tu turno dice qué es → «Mejor así: …» + por qué
    return this.agent.turns().map((t) => {
      const line = toTranscript(t, { user: cv.you, avatar: cv.avatar });
      // [2026-11-13 · Anexo A]: con feedback → la frase corregida y el comentario del corrector único (sin nota si la frase era correcta)
      const fb = t.feedback?.correccion;
      if (fb) return fb.veredicto === 'con_errores' ? { ...line, note: fb.comentario || null, noteFix: fb.frase_corregida, noteLabel: cv.feedbackBetter } : { ...line, note: null };
      const c = realCorrection(t.text, t.correction);
      if (!c) return line;
      const fix = splitCorrection(c);
      // [2026-11-09]: la frase corregida va aparte (noteFix) → la línea la pinta en verde y tacha en rojo lo que cambió
      return { ...line, note: fix.why || null, noteFix: fix.corrected || null, noteLabel: cv.feedbackBetter };
    });
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
    this.precheckGen++; // La revisión en curso ya no aplica
    this.agent.send(this.draft(), this.spoken() ? 'voz' : 'escrito'); // [Anexo A «origen»]
    this.draft.set('');
    this.reviewing.set(false);
    this.spoken.set(false);
  }

  // [listen · Progressive Enhancement]: mientras graba, el reconocimiento del navegador (Chrome/Edge) escribe en vivo en el campo;
  // al terminar, faster-whisper da el texto definitivo (más preciso y en el idioma de la sesión) | sin Web Speech: solo Whisper
  // [2026-11-09]: el dictado en vivo lo hace <aula-voice-recorder> ([language] + (transcript)) → antes la página abría OTRO reconocimiento a la vez
  // y Chrome solo admite uno (el texto no llegaba al campo)
  protected listen(): void {
    this.agent.listening();
    this.draft.set('');
    this.speechNotice.set(null);
  }

  // [recorded · 2026-11-09]: la grabación se queda SOLO en este navegador (memoria de la página; se borra al salir) — nada va al servidor
  // El texto lo da el dictado del navegador mientras se habla → queda en el campo para revisarlo, ver las correcciones y enviarlo
  protected recorded(rec: Recording): void {
    this.agent.heard(rec);
    this.draft.set(this.draft().trim() || rec.liveText?.trim() || '');
    const hasText = !!this.draft().trim();
    this.reviewing.set(hasText); // El alumno revisa y envía (no se envía solo)
    this.spoken.set(hasText); // El texto viene del dictado
    const rl = this.i18n.t().media.recorder;
    // Sin texto → POR QUÉ (dictado bloqueado, sin servicio/red, navegador sin dictado o no se entendió) y foco al campo para escribir
    const why = rec.liveError === 'denied' ? rl.dictDenied : rec.liveError === 'network' ? rl.dictNetwork : liveDictationSupported() ? rl.notHeard : `${rl.notHeard} ${rl.liveTip}`;
    this.speechNotice.set(hasText ? null : why);
    if (!hasText) this.answer()?.nativeElement.focus(); // [A11y]
  }

  protected async remove(): Promise<void> {
    if (await this.agent.remove()) await this.router.navigateByUrl('/dialogos');
  }
}
