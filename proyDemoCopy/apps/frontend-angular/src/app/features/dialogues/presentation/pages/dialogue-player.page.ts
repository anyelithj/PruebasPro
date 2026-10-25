import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { BackLinkComponent } from '@shared/ui/atoms/back-link/back-link.component';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
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
import { PASS_SIMILARITY, similarity, toTranscript } from '../../domain/models/dialogues';
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
          <p role="alert" class="text-sm text-tone-danger">{{ dialogues.dialogue.error() }}</p>
        }
      }
      @if (d) {
        <div class="mb-4 flex flex-wrap items-center gap-3">
          <aula-level-badge [level]="d.level" [status]="d.levelStatus" [labels]="tx.levelBadge" />
          <aula-role-selector [(role)]="role" [speakers]="d.speakers" [label]="tx.player.role" />
        </div>
        @if (noVoice()) {
          <p class="mb-3 rounded-xl bg-tone-warning-soft p-3 text-sm text-tone-warning">
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
            <div class="flex flex-wrap gap-2">
              @if (phase() === 'idle' || phase() === 'finished') {
                <button type="button" class="btn btn-primary" (click)="practice()">
                  ▶ {{ phase() === 'finished' ? tx.player.restart : tx.open }}
                </button>
                <button type="button" class="btn btn-outline" (click)="listenAll()">
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
                <p class="text-sm font-bold"><aula-icon name="mic" /> {{ tx.player.yourTurn }}</p>
                <aula-voice-recorder
                  [labels]="i18n.t().media.recorder"
                  [maxSeconds]="30"
                  [disabled]="dialogues.busy()"
                  [language]="d.language"
                  (started)="typed.set('')"
                  (transcript)="typed.set($event)"
                  (recorded)="spoken($event)"
                />
                <form
                  class="flex flex-wrap gap-2"
                  (submit)="$event.preventDefault(); check(typed())"
                >
                  <input
                    class="control min-w-0 flex-1"
                    [attr.lang]="d.language"
                    [attr.aria-label]="tx.player.writeInstead"
                    [placeholder]="tx.player.writeInstead"
                    [value]="typed()"
                    (input)="typed.set($any($event.target).value)"
                  />
                  <button type="submit" class="btn btn-outline" [disabled]="!typed().trim()">
                    {{ tx.player.check }}
                  </button>
                </form>
              </div>
            }
            <p
              class="text-sm font-semibold"
              aria-live="polite"
              [class.text-tone-brand]="score() >= pass"
              [class.text-tone-warning]="score() < pass"
            >
              {{ feedback() }}
            </p>
            @if (phase() === 'finished') {
              <p class="text-lg font-extrabold text-tone-brand" role="status">
                <aula-icon name="party-popper" /> {{ tx.player.finished }}
              </p>
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
  protected readonly score = signal(-1);
  protected readonly pass = PASS_SIMILARITY;
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
    return this.i18n.fmt(s >= this.pass ? p.matched : p.retry, { pct });
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
    this.go(0);
  }

  protected listenAll(): void {
    this.onlyListen = true;
    this.go(0);
  }

  protected stop(): void {
    this.speech.stop();
    this.phase.set('idle');
    this.index.set(-1);
  }

  // [go]: avanza al turno i — el del otro hablante lo dice el avatar; el propio espera la voz o el texto del usuario
  private go(i: number): void {
    const turn = this.turns()[i];
    this.score.set(-1);
    this.typed.set('');
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
    if (!said) return;
    this.typed.set(said);
    this.check(said);
  }

  // [check]: coincidencia de palabras con la frase del turno (función pura); ≥ 70 % → siguiente turno
  protected check(said: string): void {
    const turn = this.turns()[this.index()];
    if (!turn) return;
    const s = similarity(turn.text, said);
    this.score.set(s);
    if (s >= this.pass) setTimeout(() => this.go(this.index() + 1), 900); // Breve pausa para leer el resultado
  }
}
