import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { ReturnLinkComponent } from '@core/layout/return-to';
import { I18nService } from '@core/i18n/i18n.service';
import { LevelTintDirective } from '@shared/ui/atoms/level-tint/level-tint.directive';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { AvatarStageComponent } from '@shared/ui/organisms/avatar-stage/avatar-stage.component';
import { SyncedTranscriptComponent } from '@shared/ui/organisms/synced-transcript/synced-transcript.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { MusicFacade } from '../../application/music.facade';
import { SongPlayerFacade } from '../../application/song-player.facade';
import { AudioControlsComponent } from '../components/audio-controls.component';
import { PracticeLinkComponent } from '../components/practice-link.component';
// [SongPlayerPage · Presentación · Sprint 9.8 · RF-117/RF-118/RF-119]: /musica/cancion/:id — el avatar «canta» con la pista mientras la letra original con IPA y la traducción al español se muestran lado a lado y se resalta la línea que suena; repetir verso y 0,75x | [Patrón]: Container (smart) + Facade (SongPlayerFacade) + Observer (eventos del <audio>) | [Principio]: SRP + DRY (AvatarStage y SyncedTranscript compartidos) | [Paradigma]: Declarativo + Reactivo
// [A11y]: el <audio> nativo queda disponible (controles propios + teclado) · la letra sigue la canción y el seguimiento se puede apagar · [Responsive]: avatar arriba en móvil, a la izquierda desde lg

@Component({
  selector: 'aula-song-player-page',
  imports: [
    ReturnLinkComponent,
    CardPageTemplate,
    SpinnerComponent,
    LevelTintDirective,
    AvatarStageComponent,
    SyncedTranscriptComponent,
    AudioControlsComponent,
    PracticeLinkComponent,
  ],
  providers: [SongPlayerFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().music;
    @let song = music.song.data();
    <aula-card-page
      [heading]="song?.title ?? tx.title"
      [subtitle]="
        song
          ? (song.artist ? song.artist + ' · ' : '') +
            i18n.languageName(song.language) +
            ' · ' +
            song.level
          : ''
      "
    >
      <aula-return-link pageBack fallback="/musica" [label]="tx.back" /> <!-- [2026-10-25]: con ?volver= regresa a Gestión → Actividades -->
      <div pageActions class="flex flex-wrap gap-2">
        @if (song?.status === 'published') {
          <aula-practice-link [songId]="id()!" [label]="tx.player.practice" />
        }
      </div>
      @switch (music.song.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <p role="alert" class="text-sm text-tone-danger">{{ music.song.error() }}</p>
        }
      }
      <!-- El <audio> existe siempre (la fachada se conecta una vez); sin audio se oculta y se avisa -->
      <audio
        #audio
        class="hidden"
        preload="metadata"
        [src]="song?.audioKey ? music.audioUrl(id()!) : null"
      ></audio>
      @if (song) {
        <div class="grid gap-6 lg:grid-cols-[16rem_1fr]" [aulaLevel]="song.level">
          <div class="space-y-3">
            <aula-avatar-stage
              [state]="player.avatar()"
              [level]="player.lipSync.level()"
              [labels]="i18n.t().media.avatar"
              name="Aula"
            />
            <p class="text-center text-xs text-muted-foreground">{{ tx.player.voiceNote }}</p>
            <p class="text-center text-xs text-muted-foreground">© {{ license() }}</p>
          </div>
          <div class="min-w-0 space-y-4">
            @if (song.audioKey) {
              <aula-audio-controls
                [labels]="tx.player"
                [playing]="player.state() === 'singing'"
                [looping]="player.loop() !== null"
                [canRepeat]="player.timed() && player.current() >= 0"
                [rate]="player.rate()"
                [time]="player.time()"
                [duration]="player.duration()"
                (playToggle)="player.toggle()"
                (repeat)="player.repeat()"
                (rateChange)="player.setRate($event)"
              />
            } @else {
              <p class="rounded-xl bg-tone-warning-soft p-3 text-sm text-tone-warning">
                {{ tx.player.noAudio }}
              </p>
            }
            @if (song.audioKey && !player.timed()) {
              <p class="text-xs text-muted-foreground">ℹ {{ tx.player.noTiming }}</p>
            }
            <aula-synced-transcript
              [lines]="player.lines()"
              [language]="song.language"
              [current]="player.current()"
              [progress]="player.progress()"
              [follow]="player.follow()"
              [seekable]="!!song.audioKey && player.timed()"
              [labels]="i18n.t().media.transcript"
              (seek)="player.seekLine($event)"
              (followChange)="player.follow.set($event)"
            />
          </div>
        </div>
      }
    </aula-card-page>
  `,
})
export default class SongPlayerPage {
  protected readonly i18n = inject(I18nService);
  protected readonly music = inject(MusicFacade);
  protected readonly player = inject(SongPlayerFacade);
  readonly id = input<string>(); // /musica/cancion/:id (el router lo rellena con withComponentInputBinding)
  private readonly audio = viewChild.required<ElementRef<HTMLAudioElement>>('audio');

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) void this.music.loadSong(id);
    });
    effect(() => this.player.song.set(this.music.song.data()));
    afterNextRender(() => this.player.bind(this.audio().nativeElement)); // `afterNextRender`: el <audio> ya existe en el DOM
    inject(DestroyRef).onDestroy(() => this.player.stop()); // Salir de la página detiene la canción y el análisis
  }

  protected license(): string {
    const s = this.music.song.data();
    const lic = this.i18n.t().media.license;
    return s
      ? this.i18n.fmt(lic.shown, { type: lic.types[s.license.type], holder: s.license.holder })
      : '';
  }
}
