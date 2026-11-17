import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
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
import { SongPracticeComponent } from '../components/practice-link.component';
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
    SongPracticeComponent,
  ],
  providers: [SongPlayerFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().music;
    @let song = music.song.data();
    <aula-card-page
      [heading]="song?.title ?? tx.title"
      [headingLang]="song?.language ?? ''"
      [headingIpa]="song?.titleIpa ?? ''"
      [headingTranslation]="song?.titleTranslation ?? ''"
      [tight]="true"
      [headingAside]="song?.artist ?? ''"
      [subtitle]="song ? i18n.languageName(song.language) + ' · ' + song.level : ''"
    >
      <aula-return-link pageBack fallback="/musica" [label]="tx.back" />
      <!-- [2026-11-10 · «sáquelo del contenedor»]: las 3 prácticas en SU contenedor, encima del de avatar, vídeo y letra (slot pageActions = fuera de la tarjeta) -->
      @if (song?.status === 'published') {
        <section pageActions class="w-full space-y-2 rounded-2xl border border-border bg-card p-3 shadow-sm" aria-labelledby="song-practice">
          <div>
            <h2 id="song-practice" class="title-section">{{ tx.practice.section }}</h2>
            <p class="type-meta text-muted-foreground">{{ tx.practice.subtitle }}</p>
          </div>
          <aula-song-practice [songId]="id()!" />
        </section>
      } <!-- [2026-10-25]: con ?volver= regresa a Gestión → Actividades -->
      @switch (music.song.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <p role="alert" class="text-tone-danger">{{ music.song.error() }}</p>
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
        <!-- [2026-11-05 · Escenario]: avatar (con micrófono y notas) + vídeo/controles en UN contenedor estrecho y uniforme; la letra debajo a todo el ancho -->
        <!-- [2026-11-05 · Distribución]: escenario (avatar arriba + vídeo) en una columna de ~26rem fija al desplazar · letra a la derecha | apilado en móvil -->
        <!-- [2026-11-06]: escenario más ancho (26rem → 36rem) → el vídeo ya no queda diminuto -->
        <!-- [2026-11-06]: menos relleno y la letra con la MISMA altura que el escenario (lg: columna derecha relativa + letra absoluta que la llena; se desplaza dentro) -->
        <div class="grid gap-3 lg:grid-cols-[minmax(0,36rem)_minmax(0,1fr)]" [aulaLevel]="song.level">
          <!-- [2026-11-09 · «¿qué pasó con el contenedor?»]: UN solo contenedor (la tarjeta de la página) con avatar+vídeo y la letra; sin tarjetas anidadas, separadas por una línea · poco relleno lateral -->
          <!-- [2026-11-10]: avatar + vídeo en un contenedor como el de la letra · lg:mt-12 = alto de la barra «Seguir la canción» → bordes de arriba y abajo alineados -->
          <div class="grid content-start gap-2 rounded-xl border border-border bg-card p-2 lg:mt-12">
            <div class="flex flex-col items-center gap-2">
              <aula-avatar-stage
                [state]="player.avatar()"
                [level]="player.lipSync.level()"
                [labels]="i18n.t().media.avatar"
                [size]="96"
                [microphone]="true"
                [micOn]="player.sing()"
                [micLabel]="(player.sing() ? tx.player.voiceOn : tx.player.voiceOff) + ' · ' + tx.player.voiceNote"
                (micToggle)="player.sing.set(!player.sing())"
                name="Aula"
              />
            </div>
            <div class="min-w-0 space-y-2">
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
              } @else if (embed(); as src) {
                <!-- [2026-11-03]: reproductor OFICIAL del servicio (YouTube, Spotify…) · [2026-11-05]: en YouTube la letra sigue al vídeo (enablejsapi + postMessage) -->
                <iframe
                  #embedFrame
                  class="w-full rounded-xl border border-border"
                  [class.aspect-video]="!compact(song.embedUrl)"
                  [style.height.px]="compact(song.embedUrl) ? 160 : null"
                  [src]="src"
                  [title]="song.title"
                  allow="autoplay; encrypted-media; clipboard-write; picture-in-picture; fullscreen"
                  referrerpolicy="strict-origin-when-cross-origin"
                ></iframe>
              } @else {
                <p class="rounded-xl bg-tone-warning-soft p-3 text-tone-warning">
                  {{ tx.player.noAudio }}
                </p>
                <button type="button" class="btn btn-primary self-start" (click)="player.singAll()">
                  {{ player.state() === 'singing' ? tx.player.stopSinging : tx.player.singLyrics }}
                </button>
              }
              <!-- [2026-11-06 · Sincronía]: la letra va antes/después que la voz → ajuste de ± 0,5 s (o pulsar el verso que suena) -->
              <!-- [2026-11-09]: el ajuste solo aparece cuando los tiempos son APROXIMADOS (sin tiempos de la voz); con tiempos reales sobra -->
              @if (!player.timed() && player.lines().length && (song.audioKey || embed())) {
                <details class="rounded-xl bg-muted/60 p-2 type-meta">
                  <summary class="cursor-pointer font-semibold">{{ tx.player.syncAdjust }}</summary>
                  <p class="mt-1 text-muted-foreground">{{ tx.player.syncHint }}</p>
                  <div class="mt-1 flex flex-wrap items-center gap-1" role="group" [attr.aria-label]="tx.player.syncAdjust">
                    <button type="button" class="btn btn-outline btn-sm" (click)="player.nudge(-0.5)">{{ tx.player.syncEarlier }}</button>
                    <button type="button" class="btn btn-outline btn-sm" (click)="player.nudge(0.5)">{{ tx.player.syncLater }}</button>
                    @if (player.offset() !== 0) {
                      <button type="button" class="btn btn-ghost btn-sm" (click)="player.offset.set(0)">{{ tx.player.syncReset }}</button>
                    }
                  </div>
                </details>
              }
              <p class="type-meta text-muted-foreground">© {{ license() }}</p>
            </div>
          </div>
          <div class="flex min-h-[24rem] min-w-0 flex-col gap-2 lg:relative lg:min-h-0">
            <div class="flex min-h-0 flex-1 flex-col gap-2 lg:absolute lg:inset-0">
            @if (song.audioKey && !player.timed()) {
              <p class="type-meta text-muted-foreground">ℹ {{ tx.player.noTiming }}</p>
            }
            <aula-synced-transcript
              class="min-h-0 flex-1"
              [fill]="true"
              [lines]="player.lines()"
              [language]="song.language"
              [current]="player.current()"
              [progress]="player.progress()"
              [follow]="player.follow()"
              [seekable]="(!!song.audioKey || !!embed()) && player.lines().length > 0 && player.lines()[0].start != null"
              [labels]="i18n.t().media.transcript"
              (seek)="song.audioKey ? player.seekLine($event) : player.alignTo($event)"
              (followChange)="player.follow.set($event)"
            />
            </div>
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
  private readonly embedFrame = viewChild<ElementRef<HTMLIFrameElement>>('embedFrame');
  private readonly sanitizer = inject(DomSanitizer);
  // [embed · 2026-11-03]: reproductor oficial si no hay archivo | `bypassSecurityTrustResourceUrl`: seguro porque SongSchema solo deja pasar orígenes de EMBED_ORIGINS
  protected readonly embed = computed(() => {
    const s = this.music.song.data();
    if (!s || s.audioKey || !s.embedUrl) return null;
    let url = s.embedUrl;
    // YouTube: `enablejsapi=1` + `origin` → el iframe informa del tiempo por postMessage (letra sincronizada)
    if (/youtube(-nocookie)?\.com\/embed\//.test(url) && !/[?&]enablejsapi=/.test(url))
      url += (url.includes('?') ? '&' : '?') + 'enablejsapi=1&origin=' + encodeURIComponent(location.origin);
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) void this.music.loadSong(id);
    });
    effect(() => this.player.song.set(this.music.song.data()));
    afterNextRender(() => this.player.bind(this.audio().nativeElement));
    // [2026-11-05]: iframe de YouTube en pantalla → la fachada escucha su tiempo
    effect(() => {
      const f = this.embedFrame()?.nativeElement;
      if (f && /youtube/.test(this.music.song.data()?.embedUrl ?? '')) this.player.bindYouTube(f);
    }); // `afterNextRender`: el <audio> ya existe en el DOM
    inject(DestroyRef).onDestroy(() => this.player.stop()); // Salir de la página detiene la canción y el análisis
  }

  // [compact]: Spotify y SoundCloud son barras de audio (sin vídeo) → alto fijo
  protected compact(url: string | null): boolean {
    return !!url && /spotify|soundcloud|deezer|apple/.test(url);
  }

  protected license(): string {
    const s = this.music.song.data();
    const lic = this.i18n.t().media.license;
    return s
      ? this.i18n.fmt(lic.shown, { type: lic.types[s.license.type], holder: s.license.holder })
      : '';
  }
}
