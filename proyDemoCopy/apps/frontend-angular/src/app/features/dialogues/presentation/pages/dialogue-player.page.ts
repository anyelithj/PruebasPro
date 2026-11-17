import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { BackLinkComponent } from '@shared/ui/atoms/back-link/back-link.component';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  type ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LipSyncService } from '@core/audio/lip-sync.service';
import { SpeechSynthesisService } from '@core/audio/speech-synthesis.service';
import { I18nService } from '@core/i18n/i18n.service';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { SyncedTranscriptComponent } from '@shared/ui/organisms/synced-transcript/synced-transcript.component';
import {
  VoiceRecorderComponent,
  type Recording,
} from '@shared/ui/organisms/voice-recorder/voice-recorder.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { DialoguesFacade } from '../../application/dialogues.facade';
import { markWords, missingWords, PASS_SIMILARITY, similarity, toTranscript } from '../../domain/models/dialogues';
import { LevelBadgeComponent } from '../components/level-badge.component';
import { RoleSelectorComponent } from '../components/role-selector.component';
import { SpeakerAvatarsComponent } from '../components/speaker-avatars.component';
// [DialoguePlayerPage · Presentación · Sprint 9.13 · RF-123/RF-127]: /dialogos/:id — practicar un diálogo guionado como hablante A o B: el avatar dice los turnos del otro hablante (voz del navegador) y el usuario dice los suyos (voz → texto → coincidencia), con IPA y traducción lado a lado y el turno actual resaltado | [Patrón]: Container (smart) + State Machine (en reposo → escuchando → turno del usuario → terminado) | [Principio]: SRP + determinístico (la coincidencia es una función pura, sin IA) + DRY (AvatarStage, SyncedTranscript, VoiceRecorder) | [Paradigma]: Declarativo + Reactivo
// [A11y]: alternativa escrita al micrófono · estado y resultado con aria-live · aviso si el navegador no tiene voz para el idioma

type Phase = 'idle' | 'listening' | 'user' | 'finished';

@Component({
  selector: 'aula-dialogue-player-page',
  imports: [IconComponent, 
    BackLinkComponent,
    RouterLink,
    CardPageTemplate,
    SpinnerComponent,
    SyncedTranscriptComponent,
    VoiceRecorderComponent,
    LevelBadgeComponent,
    RoleSelectorComponent,
    SpeakerAvatarsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().dialogues;
    @let d = dialogues.dialogue.data();
    <aula-card-page
      [heading]="d?.title ?? tx.library"
      [headingLang]="d?.language ?? ''"
      [subtitle]="d ? i18n.languageName(d.language) : ''"
    >
      <a aulaBackLink pageBack routerLink="/dialogos/biblioteca"
        >{{ tx.backToLibrary }}</a
      >
      @switch (dialogues.dialogue.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <p role="alert" class="text-tone-danger">{{ dialogues.dialogue.error() }}</p>
        }
      }
      @if (d) {
        <div class="mb-4 flex flex-wrap items-center gap-3">
          <aula-level-badge [level]="d.level" [status]="d.levelStatus" [labels]="tx.levelBadge" />
          <aula-role-selector [(role)]="role" [speakers]="d.speakers" [label]="tx.player.role" />
        </div>
        @if (noVoice()) {
          <p class="mb-3 rounded-xl bg-tone-warning-soft p-3 text-tone-warning">
            <aula-icon name="triangle-alert" /> {{ i18n.t().media.noVoice }}
          </p>
        }
        <div class="grid gap-6 lg:grid-cols-[18rem_1fr]">
          <div class="space-y-3">
            <aula-speaker-avatars
              [names]="d.speakers"
              [active]="activeSpeaker()"
              [speaking]="speech.speaking()"
              [userRole]="role()"
              [level]="lipSync.level()"
              [labels]="i18n.t().media.avatar"
              [youLabel]="tx.conversation.you"
            />
            <!-- [2026-11-06]: «Practicar» y «Escuchar» en la MISMA fila (flex-nowrap + mitades iguales) -->
            <div class="flex gap-2">
              @if (phase() === 'idle' || phase() === 'finished') {
                <button type="button" class="btn btn-primary flex-1" (click)="practice()">
                  ▶ {{ phase() === 'finished' ? tx.player.restart : tx.open }}
                </button>
                <button type="button" class="btn btn-outline flex-1" (click)="listenAll()">
                  <aula-icon name="headphones" /> {{ tx.player.listen }}
                </button>
              } @else {
                <button type="button" class="btn btn-outline" (click)="stop()">
                  <aula-icon name="square" /> {{ tx.player.stop }}
                </button>
              }
            </div>
          </div>
          <div class="min-w-0 space-y-4">
            @if (phase() === 'user') {
              <div class="space-y-3 rounded-xl border-2 border-primary bg-tone-brand-soft p-4">
                <p class="font-bold"><aula-icon name="mic" /> {{ tx.player.yourTurn }}</p>
                <aula-voice-recorder
                  [labels]="i18n.t().media.recorder"
                  [maxSeconds]="30"
                  [disabled]="dialogues.busy()"
                  [language]="d.language"
                  (started)="typed.set(''); speechNotice.set(null); score.set(-1)"
                  (transcript)="typed.set($event)"
                  (recorded)="spoken($event)"
                />
                <form
                  class="flex flex-wrap gap-2"
                  (submit)="$event.preventDefault(); check(typed())"
                >
                  <input
                    #answer
                    class="control min-w-0 flex-1"
                    [attr.lang]="d.language"
                    [attr.aria-label]="tx.player.writeInstead"
                    [placeholder]="tx.player.writeInstead"
                    [value]="typed()"
                    (input)="typed.set($any($event.target).value); score.set(-1)"
                  />
                  <button type="submit" class="btn btn-outline" [disabled]="!typed().trim()">
                    {{ tx.player.check }}
                  </button>
                </form>
                <!-- [2026-10-25 · Respaldo]: servidor sin voz a texto o audio no válido → aviso accionable (role="status": no interrumpe) -->
                @if (speechNotice(); as notice) {
                  <p class="type-meta font-semibold text-tone-warning" role="status"><aula-icon name="info" /> {{ notice }}</p>
                }
                @if (fromVoice() && score() < 0) {
                  <p class="type-meta text-muted-foreground" role="status"><aula-icon name="info" /> {{ tx.player.reviewVoice }}</p>
                }
                <!-- [2026-11-06 · Corrección]: % grande + frase esperada y lo dicho, palabra a palabra (rojo = falló, verde = bien; tachado/subrayado además del color, WCAG 1.4.1) -->
                @if (score() >= 0) {
                  <div class="space-y-2 rounded-xl border border-border bg-card p-3" aria-live="polite">
                    <p class="flex items-center gap-3">
                      <span class="text-3xl font-extrabold tabular-nums" [class.text-tone-brand]="score() >= pass" [class.text-tone-danger]="score() < pass">{{ pct() }} %</span>
                      <span class="font-semibold">{{ feedback() }}</span>
                    </p>
                    <p class="type-meta font-semibold text-muted-foreground">{{ tx.player.expected }}</p>
                    <p [attr.lang]="d.language" class="text-lg leading-relaxed">
                      @for (w of expectedMarks(); track $index) {
                        <span [class]="w.ok === false ? 'rounded bg-tone-danger-soft px-0.5 font-semibold text-tone-danger underline decoration-wavy' : w.ok ? 'text-tone-brand' : ''">{{ w.text }}</span>
                      }
                    </p>
                    <p class="type-meta font-semibold text-muted-foreground">{{ tx.player.yours }}</p>
                    <p [attr.lang]="d.language" class="leading-relaxed">
                      @for (w of saidMarks(); track $index) {
                        <span [class]="w.ok === false ? 'rounded bg-tone-danger-soft px-0.5 text-tone-danger line-through' : ''">{{ w.text }}</span>
                      }
                    </p>
                    @if (score() >= pass) {
                      <button type="button" class="btn btn-primary btn-sm" (click)="go(index() + 1)">{{ tx.player.next }} →</button>
                    }
                  </div>
                }
              </div>
            }
            @if (phase() === 'finished') {
              <p class="type-lead font-extrabold text-tone-brand" role="status">
                <aula-icon name="party-popper" /> {{ tx.player.finished }}
              </p>
              <!-- [2026-11-06 · Reporte final]: media de los % de cada turno del alumno + frases a mejorar con lo que faltó (mismo diseño que la corrección por turno) -->
              @if (report(); as r) {
                <section class="space-y-3 rounded-xl border border-border bg-card p-4" aria-live="polite" [attr.aria-label]="tx.player.reportTitle">
                  <h2 class="title-card">{{ tx.player.reportTitle }}</h2>
                  <p class="flex flex-wrap items-center gap-3">
                    <span class="text-4xl font-extrabold tabular-nums" [class.text-tone-brand]="r.avg >= pass" [class.text-tone-danger]="r.avg < pass">{{ round(r.avg) }} %</span>
                    <span>
                      <span class="block type-meta text-muted-foreground">{{ i18n.fmt(tx.player.reportScore, { n: r.items.length }) }}</span>
                      <span class="block font-semibold">{{ r.avg >= 0.9 ? tx.player.reportGreat : r.avg >= pass ? tx.player.reportGood : tx.player.reportWeak }}</span>
                    </span>
                  </p>
                  <h3 class="font-semibold">{{ tx.player.toImprove }}</h3>
                  @for (it of r.weak; track it.index) {
                    <div class="space-y-1 border-t border-border pt-2">
                      <p class="flex items-baseline gap-2">
                        <span class="font-bold tabular-nums text-tone-danger">{{ it.checked === null ? tx.player.skipped : round(it.score) + ' %' }}</span>
                        <span [attr.lang]="d.language">
                          @for (w of it.marks; track $index) {
                            <span [class]="w.ok === false ? 'rounded bg-tone-danger-soft px-0.5 font-semibold text-tone-danger underline decoration-wavy' : w.ok ? 'text-tone-brand' : ''">{{ w.text }}</span>
                          }
                        </span>
                      </p>
                      @if (it.checked) {
                        <p class="type-meta text-muted-foreground">{{ tx.player.yours }} <span [attr.lang]="d.language">{{ it.checked }}</span></p>
                      }
                    </div>
                  } @empty {
                    <p class="text-tone-brand">{{ i18n.fmt(tx.player.allGood, { pct: 90 }) }}</p>
                  }
                </section>
              }
            }
            <aula-synced-transcript
              [lines]="lines()"
              [language]="d.language"
              [current]="index()"
              [follow]="follow()"
              [labels]="i18n.t().media.transcript"
              (followChange)="follow.set($event)"
            />
          </div>
        </div>
      }
    </aula-card-page>
  `,
})
export default class DialoguePlayerPage {
  protected readonly i18n = inject(I18nService);
  protected readonly dialogues = inject(DialoguesFacade);
  protected readonly speech = inject(SpeechSynthesisService);
  protected readonly lipSync = inject(LipSyncService);
  readonly id = input<string>(); // /dialogos/:id (el router lo rellena con withComponentInputBinding)
  protected readonly role = signal<'A' | 'B'>('A');
  protected readonly phase = signal<Phase>('idle');
  protected readonly index = signal(-1);
  protected readonly follow = signal(true);
  protected readonly typed = signal('');
  protected readonly speechNotice = signal<string | null>(null); // [2026-10-25]: aviso si el servidor no pudo transcribir
  private readonly answer = viewChild<ElementRef<HTMLInputElement>>('answer'); // `viewChild` (Angular 17.2+): campo para escribir la respuesta
  protected readonly score = signal(-1);
  protected readonly checked = signal(''); // [2026-11-06]: texto comprobado (el campo puede seguir editándose)
  protected readonly fromVoice = signal(false); // El campo se rellenó con la voz → aviso «revisa y pulsa Comprobar»
  protected readonly pct = computed(() => Math.round(Math.max(this.score(), 0) * 100));
  protected readonly expectedMarks = computed(() => markWords(this.turns()[this.index()]?.text ?? '', this.checked()));
  protected readonly saidMarks = computed(() => markWords(this.checked(), this.turns()[this.index()]?.text ?? ''));
  protected readonly pass = PASS_SIMILARITY;
  protected readonly round = (x: number): number => Math.round(x * 100);
  // [2026-11-06 · Reporte final]: primer intento de cada turno del alumno (índice → texto y %) | se limpia al empezar a practicar
  private readonly attempts = signal<ReadonlyMap<number, { checked: string; score: number }>>(new Map());
  protected readonly report = computed(() => {
    if (this.onlyListenRun()) return null;
    const mine = this.turns().map((t, index) => ({ t, index })).filter(({ t }) => t.speaker === this.role());
    if (!mine.length || !this.attempts().size) return null;
    const items = mine.map(({ t, index }) => {
      const a = this.attempts().get(index);
      return { index, score: a?.score ?? 0, checked: a?.checked ?? null, marks: markWords(t.text, a?.checked ?? '') };
    });
    const avg = items.reduce((n, i) => n + i.score, 0) / items.length;
    return { avg, items, weak: items.filter((i) => i.score < 0.9) };
  });
  private readonly onlyListenRun = signal(false);
  private onlyListen = false;
  protected readonly turns = computed(() => this.dialogues.dialogue.data()?.turns ?? []);
  protected readonly lines = computed(() => {
    const [a, b] = this.dialogues.dialogue.data()?.speakers ?? ['A', 'B'];
    return this.turns().map((t) => toTranscript(t, { A: a, B: b }));
  });
  protected readonly activeSpeaker = computed(
    () => (this.turns()[this.index()]?.speaker as 'A' | 'B' | undefined) ?? null,
  );
  protected readonly noVoice = computed(() => {
    const d = this.dialogues.dialogue.data();
    return !!d && !this.speech.hasVoice(d.language);
  });
  protected readonly feedback = computed(() => {
    const s = this.score();
    if (s < 0) return '';
    const pct = String(Math.round(s * 100));
    const p = this.i18n.t().dialogues.player;
    const result = this.i18n.fmt(s >= this.pass ? p.matched : p.retry, { pct });
    // [Corrector · 2026-11-05]: qué palabras faltaron o no se entendieron
    const miss = missingWords(this.turns()[this.index()]?.text ?? '', this.checked());
    return miss.length ? `${result} ${this.i18n.fmt(p.missing, { words: miss.map((w) => `«${w}»`).join(', ') })}` : result;
  });

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) void this.dialogues.loadDialogue(id);
    });
    inject(DestroyRef).onDestroy(() => this.speech.stop());
  }

  protected practice(): void {
    this.onlyListen = false;
    this.onlyListenRun.set(false);
    this.attempts.set(new Map());
    this.go(0);
  }

  protected listenAll(): void {
    this.onlyListen = true;
    this.onlyListenRun.set(true);
    this.go(0);
  }

  protected stop(): void {
    this.speech.stop();
    this.phase.set('idle');
    this.index.set(-1);
  }

  // [go]: avanza al turno i — el del otro hablante lo dice el avatar; el propio espera la voz o el texto del usuario
  protected go(i: number): void {
    const turn = this.turns()[i];
    this.score.set(-1);
    this.typed.set('');
    this.fromVoice.set(false);
    if (!turn) {
      this.phase.set('finished');
      this.index.set(-1);
      return;
    }
    this.index.set(i);
    if (!this.onlyListen && turn.speaker === this.role()) {
      this.phase.set('user');
      return;
    }
    this.phase.set('listening');
    this.speech.speak(turn.text, this.dialogues.dialogue.data()!.language, 0.9, {
      boundary: () => this.lipSync.pulse(),
      end: () => {
        this.lipSync.level.set(0);
        if (this.phase() === 'listening' && this.index() === i) this.go(i + 1);
      },
    });
  }

  protected async spoken(rec: Recording): Promise<void> {
    const text = await this.dialogues.transcribe(
      rec.blob,
      this.dialogues.dialogue.data()!.language,
    );
    // [2026-10-23]: lo dicho queda ESCRITO en el campo (Whisper o, si falla, el dictado en vivo) → el alumno ve sus errores, corrige y vuelve a comprobar
    const said = text || rec.liveText;
    // [2026-11-05]: servidor sin voz a texto → sin aviso (el dictado del navegador basta); el alumno recibe el corrector de palabras al comprobar
    this.speechNotice.set(this.dialogues.serverSpeechDown() ? null : this.dialogues.actionError());
    if (!said) {
      this.answer()?.nativeElement.focus(); // [A11y]: foco en el campo para escribir la respuesta
      return;
    }
    // [2026-11-06]: ya NO se comprueba solo → el alumno revisa el texto y pulsa «Comprobar»
    this.typed.set(said);
    this.fromVoice.set(true);
    this.answer()?.nativeElement.focus();
  }

  // [check]: coincidencia de palabras con la frase del turno (función pura); ≥ 70 % → siguiente turno
  protected check(said: string): void {
    const turn = this.turns()[this.index()];
    if (!turn) return;
    this.checked.set(said);
    const score = similarity(turn.text, said);
    this.attempts.update((m) => (m.has(this.index()) ? m : new Map(m).set(this.index(), { checked: said, score }))); // Cuenta el PRIMER intento: los reintentos sirven para avanzar, no para inflar la nota
    this.score.set(score); // [2026-11-06]: sin avance automático → «Siguiente turno» cuando se supera
  }
}
