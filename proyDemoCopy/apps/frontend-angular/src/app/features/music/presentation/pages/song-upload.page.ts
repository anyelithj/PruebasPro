import { ReturnLinkComponent, ReturnToService } from '@core/layout/return-to'; // [2026-10-23]: «Volver» y salida hacia Gestión → Actividades cuando se llega con ?volver=
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CEFR_LEVELS, LANGUAGES } from '@aula/shared-schemas';
import { pickLanguage, pickLevel } from '@core/layout/prefill'; // [2026-10-24]: ?idioma=&nivel= desde Gestión → Crear actividad
import { SessionService } from '@core/auth/session.service';
import { I18nService } from '@core/i18n/i18n.service';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import {
  EMPTY_LICENSE,
  LicenseDeclarationComponent,
  licenseProblem,
  type LicenseValue,
} from '@shared/ui/organisms/license-declaration/license-declaration.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { MusicFacade } from '../../application/music.facade';
import { MAX_AUDIO_MB, type LinePatch, type LineTiming } from '../../domain/models/music';
import { AudioUploaderComponent } from '../components/audio-uploader.component';
import { LyricsEditorComponent } from '../components/lyrics-editor.component';
import { SyncEditorComponent } from '../components/sync-editor.component';
// [SongUploadPage · Presentación · Sprint 9.9 · RF-116/RF-117/RF-119/RF-128]: /musica/subir[/:id] — asistente de tres pasos: datos + licencia + audio → letra con IPA y traducción revisables → sincronización al ritmo (o propuesta automática); envío a revisión y decisión del ADMIN | [Patrón]: Container (smart) + Wizard (pasos) + Facade | [Principio]: SRP (cada paso es un componente) + cumplimiento de derechos de autor (sin licencia no se guarda) + verificación humana | [Paradigma]: Declarativo + Reactivo
// [A11y]: pasos como lista con aria-current="step" · cada paso con su encabezado · mensajes de estado con aria-live

@Component({
  selector: 'aula-song-upload-page',
  imports: [IconComponent, 
    ReturnLinkComponent,
    RouterLink,
    CardPageTemplate,
    SpinnerComponent,
    LicenseDeclarationComponent,
    AudioUploaderComponent,
    LyricsEditorComponent,
    SyncEditorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().music;
    @let wz = tx.wizard;
    @let song = id() ? music.song.data() : null;
    <aula-card-page
      [heading]="id() ? wz.edit : wz.title"
      [subtitle]="song ? song.title + ' · ' + tx.status[song.status] : ''"
    >
      <aula-return-link pageBack fallback="/musica" [label]="tx.back" />

      <ol class="mb-6 grid gap-2 sm:grid-cols-3">
        @for (label of wz.steps; track $index) {
          <li>
            <button
              type="button"
              class="flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors"
              [class]="
                step() === $index
                  ? 'border-primary bg-tone-brand-soft text-tone-brand'
                  : 'border-border text-muted-foreground'
              "
              [attr.aria-current]="step() === $index ? 'step' : null"
              [disabled]="$index > 0 && !id()"
              (click)="step.set($index)"
            >
              <span
                class="grid size-6 place-items-center rounded-full bg-gradient-brand text-xs text-white"
                >{{ $index + 1 }}</span
              >{{ label }}
            </button>
          </li>
        }
      </ol>

      @if (id() && music.song.status() === 'loading') {
        <aula-spinner [label]="i18n.t().common.loading" />
      }
      @if (song?.status === 'rejected') {
        <p class="mb-4 rounded-xl bg-tone-danger-soft p-3 text-sm text-tone-danger">
          ✕ {{ i18n.fmt(wz.rejected, { note: song!.reviewNote }) }}
        </p>
      }

      @switch (step()) {
        @case (0) {
          <section class="space-y-4" aria-labelledby="step-1">
            <h2 id="step-1" class="text-lg font-extrabold">{{ wz.steps[0] }}</h2>
            @if (!id()) {
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="text-xs font-semibold text-muted-foreground">
                  {{ wz.songTitle }}
                  <input
                    class="control mt-1 w-full"
                    required
                    maxlength="160"
                    [value]="title()"
                    (input)="title.set($any($event.target).value)"
                  />
                </label>
                <label class="text-xs font-semibold text-muted-foreground">
                  {{ wz.artist }}
                  <input
                    class="control mt-1 w-full"
                    maxlength="160"
                    [value]="artist()"
                    (input)="artist.set($any($event.target).value)"
                  />
                </label>
                <label class="text-xs font-semibold text-muted-foreground">
                  {{ tx.language }}
                  <select
                    class="control mt-1 w-full"
                    [value]="language()"
                    (change)="language.set($any($event.target).value)"
                  >
                    @for (code of languages; track code) {
                      <option [value]="code">{{ i18n.languageName(code) }}</option>
                    }
                  </select>
                </label>
                <label class="text-xs font-semibold text-muted-foreground">
                  {{ tx.level }}
                  <select
                    class="control mt-1 w-full"
                    [value]="level()"
                    (change)="level.set($any($event.target).value)"
                  >
                    @for (l of levels; track l) {
                      <option [value]="l">{{ l }}</option>
                    }
                  </select>
                </label>
              </div>
              <aula-license-declaration [(value)]="license" [labels]="i18n.t().media.license" />
              <button
                type="button"
                class="btn btn-primary"
                [disabled]="!canCreate() || music.busy()"
                (click)="create()"
              >
                <aula-icon name="save" /> {{ wz.save }}
              </button>
            } @else if (song) {
              <p class="text-sm">
                <strong>{{ song.title }}</strong> · {{ i18n.languageName(song.language) }} ·
                {{ song.level }} · ©
                {{
                  i18n.fmt(i18n.t().media.license.shown, {
                    type: i18n.t().media.license.types[song.license.type],
                    holder: song.license.holder,
                  })
                }}
              </p>
              <aula-audio-uploader
                [label]="i18n.fmt(wz.audio, { mb: maxMb })"
                [uploadLabel]="wz.uploadAudio"
                [doneLabel]="wz.audioReady"
                [tooBig]="i18n.fmt(wz.audioTooBig, { mb: maxMb })"
                [maxMb]="maxMb"
                [busy]="music.busy()"
                [done]="!!song.audioKey"
                (upload)="music.uploadAudio(id()!, $event)"
                [urlLabel]="wz.audioUrl"
                [urlButton]="wz.audioUrlUpload"
                (uploadUrl)="music.uploadAudioUrl(id()!, $event)"
              />
              <button type="button" class="btn btn-outline" (click)="step.set(1)">
                {{ wz.next }} →
              </button>
            }
          </section>
        }
        @case (1) {
          <section class="space-y-4" aria-labelledby="step-2">
            <h2 id="step-2" class="text-lg font-extrabold">{{ wz.steps[1] }}</h2>
            <aula-lyrics-editor
              [lines]="song?.lines ?? []"
              [language]="song?.language ?? 'en'"
              [busy]="music.busy()"
              [labels]="wz"
              (loadLyrics)="loadLyrics($event.lyrics, $event.auto)"
              (save)="saveLines($event)"
            />
            @if (enrichFailed()) {
              <p
                role="status"
                class="rounded-xl bg-tone-warning-soft p-3 text-sm text-tone-warning"
              >
                <aula-icon name="triangle-alert" /> {{ wz.enrichFailed }}
              </p>
            }
          </section>
        }
        @case (2) {
          <section class="space-y-4" aria-labelledby="step-3">
            <h2 id="step-3" class="text-lg font-extrabold">{{ wz.steps[2] }}</h2>
            @if (song?.audioKey) {
              <aula-sync-editor
                [lines]="song!.lines"
                [audioUrl]="music.audioUrl(id()!)"
                [language]="song!.language"
                [busy]="music.busy()"
                [proposal]="proposal()"
                [labels]="tx.sync"
                (propose)="propose()"
                (save)="saveLines($event.lines, $event.source)"
              />
            } @else {
              <p class="rounded-xl bg-tone-warning-soft p-3 text-sm text-tone-warning">
                {{ tx.player.noAudio }}
              </p>
            }
          </section>
        }
      }

      <p class="mt-4 text-sm font-semibold text-tone-brand" aria-live="polite">{{ notice() }}</p>
      @if (music.actionError()) {
        <p role="alert" class="text-sm text-tone-danger">{{ music.actionError() }}</p>
      }

      @if (song) {
        <div class="mt-6 flex flex-wrap gap-2 border-t border-border pt-4">
          @if (song.status === 'draft' || song.status === 'rejected') {
            <button
              type="button"
              class="btn btn-primary"
              [disabled]="music.busy()"
              (click)="submit()"
            >
              <aula-icon name="send" /> {{ wz.submit }}
            </button>
          }
          @if (admin() && song.status === 'review') {
            <button
              type="button"
              class="btn btn-primary"
              [disabled]="music.busy()"
              (click)="decide('published')"
            >
              ✓ {{ tx.publish }}
            </button>
            <input
              class="control h-10 w-64 text-sm"
              [attr.aria-label]="tx.rejectReason"
              [placeholder]="tx.rejectReason"
              (input)="reason.set($any($event.target).value)"
            />
            <button
              type="button"
              class="btn btn-outline"
              [disabled]="music.busy() || !reason().trim()"
              (click)="decide('rejected')"
            >
              ✕ {{ tx.reject }}
            </button>
          }
          @if (song.status === 'published') {
            <a class="btn btn-outline" [routerLink]="['/musica/cancion', song.id]"
              ><aula-icon name="headphones" /> {{ tx.listen }}</a
            >
          }
          <button
            type="button"
            class="btn btn-danger ml-auto"
            [disabled]="music.busy()"
            (click)="withdraw()"
          >
            <aula-icon name="trash-2" /> {{ wz.withdraw }}
          </button>
        </div>
      }
    </aula-card-page>
  `,
})
export default class SongUploadPage {
  protected readonly i18n = inject(I18nService);
  protected readonly music = inject(MusicFacade);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly returnTo = inject(ReturnToService); // [2026-10-23]: conserva ?volver= y regresa a Gestión
  readonly id = input<string>(); // /musica/subir/:id (opcional: sin id = canción nueva)
  readonly idioma = input<string>(); // [2026-10-24]: ?idioma= (withComponentInputBinding)
  readonly nivel = input<string>(); // ?nivel=
  protected readonly languages = LANGUAGES;
  protected readonly levels = CEFR_LEVELS;
  protected readonly maxMb = MAX_AUDIO_MB;
  protected readonly step = signal(0);
  protected readonly title = signal('');
  protected readonly artist = signal('');
  protected readonly language = signal<string>('en');
  protected readonly level = signal<string>('A2');
  protected readonly license = signal<LicenseValue>({ ...EMPTY_LICENSE });
  protected readonly enrichFailed = signal(false);
  protected readonly proposal = signal<LineTiming[] | null>(null);
  protected readonly notice = signal('');
  protected readonly reason = signal('');
  protected readonly admin = computed(() => this.session.hasRole('ADMIN'));
  protected readonly canCreate = computed(
    () => this.title().trim().length >= 2 && !licenseProblem(this.license()),
  );

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) void this.music.loadSong(id);
    });
    // [Prefill · 2026-10-24]: canción nueva → idioma y nivel elegidos en Gestión
    effect(() => {
      const [language, level] = [pickLanguage(this.idioma()), pickLevel(this.nivel())];
      if (this.id()) return;
      untracked(() => {
        if (language) this.language.set(language);
        if (level) this.level.set(level);
      });
    });
  }

  protected async create(): Promise<void> {
    const song = await this.music.createSong({
      title: this.title().trim(),
      artist: this.artist().trim() || undefined,
      language: this.language(),
      level: this.level(),
      license: this.license(),
    });
    if (song) await this.returnTo.go(['/musica/subir', song.id]); // Con id: se habilitan audio, letra y sincronización
  }

  protected async loadLyrics(lyrics: string, auto: boolean): Promise<void> {
    const enriched = await this.music.loadLyrics(this.id()!, lyrics, auto);
    this.enrichFailed.set(auto && enriched === false); // En modo manual no se pidió IPA → no es un fallo
  }

  protected async saveLines(lines: LinePatch[], source?: 'manual' | 'auto'): Promise<void> {
    if (await this.music.saveLines(this.id()!, lines, source)) {
      this.notice.set(this.i18n.t().music.wizard.saved);
      this.proposal.set(null);
    }
  }

  protected async propose(): Promise<void> {
    this.proposal.set(await this.music.proposeTimings(this.id()!));
  }

  protected async submit(): Promise<void> {
    if (await this.music.submitForReview(this.id()!))
      this.notice.set(this.i18n.t().music.wizard.submitted);
  }

  protected async decide(decision: 'published' | 'rejected'): Promise<void> {
    if (await this.music.review(this.id()!, decision, this.reason().trim() || undefined))
      await this.music.loadSong(this.id()!);
  }

  protected async withdraw(): Promise<void> {
    if (await this.music.withdraw(this.id()!)) await this.returnTo.leave('/musica');
  }
}
