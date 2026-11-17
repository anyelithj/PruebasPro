import { ReturnLinkComponent, ReturnToService } from '@core/layout/return-to'; // [2026-10-23]: «Volver» y salida hacia Gestión → Actividades cuando se llega con ?volver=
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { DomSanitizer } from '@angular/platform-browser';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { CEFR_LEVELS, LANGUAGES } from '@aula/shared-schemas';
import { pickLanguage, pickLevel } from '@core/layout/prefill'; // [2026-10-24]: ?idioma=&nivel= desde Gestión → Crear actividad
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
import {
  MAX_AUDIO_MB,
  publishBlockers,
  type LinePatch,
  type LineTiming,
  type SongBlocker,
} from '../../domain/models/music';
import { LyricsImportService } from '../../infrastructure/lyrics-import.service';
import { AudioUploaderComponent } from '../components/audio-uploader.component';
import { LyricsEditorComponent } from '../components/lyrics-editor.component';
import { SyncEditorComponent } from '../components/sync-editor.component';
// [SongUploadPage · Presentación · Sprint 9.9 · RF-116/RF-117/RF-119/RF-128]: /musica/subir[/:id] — asistente de tres pasos: datos + licencia + audio → letra con IPA y traducción revisables → sincronización al ritmo (o propuesta automática); envío a revisión y decisión del ADMIN | [Patrón]: Container (smart) + Wizard (pasos) + Facade | [Principio]: SRP (cada paso es un componente) + cumplimiento de derechos de autor (sin licencia no se guarda) + verificación humana | [Paradigma]: Declarativo + Reactivo
// [A11y]: pasos como lista con aria-current="step" · cada paso con su encabezado · mensajes de estado con aria-live
// [manualLines · 2026-11-06]: línea i del IPA y de la traducción ↔ línea i de la letra (las vacías de la letra = separadores de estrofa, se saltan como en splitLyrics) | Función pura
export function manualLines(lyrics: string, ipas: string, translations: string, lines: readonly { id: string }[]): LinePatch[] {
  const [ip, tx] = [ipas.split(/\r?\n/), translations.split(/\r?\n/)];
  const paired = lyrics
    .split(/\r?\n/)
    .map((l, i) => ({ l: l.trim(), ipa: (ip[i] ?? '').trim(), t: (tx[i] ?? '').trim() }))
    .filter((p) => p.l);
  return paired.flatMap((p, i) =>
    (p.ipa || p.t) && lines[i] ? [{ id: lines[i]!.id, ...(p.ipa && { ipa: p.ipa }), ...(p.t && { translation: p.t }) }] : [],
  );
}
// [2026-10-24]: + letra ORIGINAL con IA al crear (mismo flujo: IPA, traducción, audio y revisión) · reintento de IPA/traducción solo de los versos que faltan · checklist de publicación (los botones se desactivan y explican qué falta, en vez de fallar en el servidor con «Falta subir el audio»)

@Component({
  selector: 'aula-song-upload-page',
  imports: [IconComponent, 
    ReturnLinkComponent,
    CardPageTemplate,
    SpinnerComponent,
    LicenseDeclarationComponent,
    AudioUploaderComponent,
    LyricsEditorComponent,
    SyncEditorComponent,
  ],
  // [2026-10-24 · DI]: el mismo importador de letras que usa el paso «Letra» (NestJS from-url + respaldo de Next.js) → «Importar la letra desde este enlace» en el paso del audio | [Principio]: DRY
  providers: [LyricsImportService],
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
              (click)="goTo($index)"
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
        <p class="mb-4 rounded-xl bg-tone-danger-soft p-3 text-tone-danger">
          ✕ {{ i18n.fmt(wz.rejected, { note: song!.reviewNote }) }}
        </p>
      }

      @switch (step()) {
        @case (0) {
          <section class="space-y-4" aria-labelledby="step-1">
            <h2 id="step-1" class="title-section">{{ wz.steps[0] }}</h2>
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
                <!-- [2026-11-04]: idioma y nivel ya elegidos en Gestión (?idioma=&nivel=) → se muestran fijos, no se vuelven a pedir -->
                @if (preset()) {
                  <p class="text-xs font-semibold text-muted-foreground sm:col-span-2">
                    {{ tx.language }}: <span class="badge bg-tone-brand-soft text-tone-brand">{{ i18n.languageName(language()) }}</span>
                    · {{ tx.level }}: <span class="badge bg-tone-brand-soft text-tone-brand">{{ level() || wz.levelPending }}</span>
                  </p>
                } @else {
                  <!-- [selected] por opción (no [value] en el <select>): las <option> del @for se crean después y el navegador elegía la primera -->
                  <label class="text-xs font-semibold text-muted-foreground">
                    {{ tx.language }}
                    <select class="control mt-1 w-full" (change)="language.set($any($event.target).value)">
                      @for (code of languages; track code) {
                        <option [value]="code" [selected]="code === language()">{{ i18n.languageName(code) }}</option>
                      }
                    </select>
                  </label>
                  <!-- [2026-11-16 · RF-148]: al CREAR el nivel no se elige: NestJS lo estima de la letra · se cambia al editar -->
                  <p class="self-end text-xs text-muted-foreground">{{ wz.levelAuto }}</p>
                }
              </div>
              <aula-license-declaration [(value)]="license" [labels]="i18n.t().media.license" />
              <div class="flex flex-wrap justify-end gap-2">
                <button type="button" class="btn btn-ghost" (click)="cancel()">{{ wz.cancel }}</button>
                <button
                  type="button"
                  class="btn btn-primary"
                  [disabled]="!canCreate() || music.busy()"
                  (click)="create()"
                >
                  {{ wz.save }} →
                </button>
              </div>
            } @else if (song) {
              <!-- [2026-11-10 · «me debe permitir editar todo»]: datos de la canción editables (título, artista, nivel, IPA y traducción del título, licencia) -->
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="text-xs font-semibold text-muted-foreground">
                  {{ wz.songTitle }}
                  <input class="control mt-1 w-full" required maxlength="160" [attr.lang]="song.language" [value]="title()" (input)="title.set($any($event.target).value)" />
                </label>
                <label class="text-xs font-semibold text-muted-foreground">
                  {{ wz.artist }}
                  <input class="control mt-1 w-full" maxlength="160" [value]="artist()" (input)="artist.set($any($event.target).value)" />
                </label>
                <label class="text-xs font-semibold text-muted-foreground">
                  IPA del título
                  <input class="control mt-1 w-full font-mono" lang="und-fonipa" maxlength="300" placeholder="Se calcula solo si lo dejas vacío" [value]="titleIpa()" (input)="titleIpa.set($any($event.target).value)" />
                </label>
                @if (song.language !== 'es') {
                  <label class="text-xs font-semibold text-muted-foreground">
                    Traducción del título
                    <input class="control mt-1 w-full" lang="es" maxlength="300" [value]="titleTranslation()" (input)="titleTranslation.set($any($event.target).value)" />
                  </label>
                }
                <p class="text-xs font-semibold text-muted-foreground">
                  {{ tx.language }}: <span class="badge bg-tone-brand-soft text-tone-brand">{{ i18n.languageName(song.language) }}</span>
                </p>
                <label class="text-xs font-semibold text-muted-foreground">
                  {{ tx.level }}
                  <select class="control mt-1 w-full" (change)="level.set($any($event.target).value)">
                    @if (!level()) {
                      <option value="" selected disabled>{{ wz.levelPending }}</option>
                    }
                    @for (l of levels; track l) {
                      <option [value]="l" [selected]="l === level()">{{ l }}</option>
                    }
                  </select>
                </label>
              </div>
              <aula-license-declaration [(value)]="license" [labels]="i18n.t().media.license" />
              <div class="flex flex-wrap justify-end gap-2">
                <button type="button" class="btn btn-ghost" (click)="cancel()">{{ wz.cancel }}</button>
                <button type="button" class="btn btn-primary" [disabled]="!canCreate() || music.busy()" (click)="saveDetails()">Guardar</button>
                <button type="button" class="btn btn-outline" (click)="step.set(1)">{{ wz.next }}</button>
              </div>
            }
          </section>
        }
        @case (1) {
          <section class="space-y-4" aria-labelledby="step-2">
            <h2 id="step-2" class="title-section">{{ wz.steps[1] }}</h2>
            @if (song) {
              <aula-audio-uploader
                [label]="i18n.fmt(wz.audio, { mb: maxMb })"
                [uploadLabel]="wz.uploadAudio"
                [doneLabel]="wz.audioReady"
                [tooBig]="i18n.fmt(wz.audioTooBig, { mb: maxMb })"
                [maxMb]="maxMb"
                [busy]="music.busy()"
                [done]="!!song.audioKey || !!song.embedUrl"
                (upload)="music.uploadAudio(id()!, $event)"
                [urlLabel]="wz.audioUrl"
                [urlButton]="wz.audioUrlUpload"
                (uploadUrl)="music.uploadAudioUrl(id()!, $event)"
                [linkRules]="music.linkRules()"
                [linkLabels]="wz.audioLink"
                [importingLyrics]="importingLyrics()"
                (importLyrics)="importLyricsFrom($event)"
              />
              @if (importError()) {
                <p role="alert" class="type-meta font-semibold text-tone-danger">{{ importError() }}</p>
              }
              <!-- [2026-11-04]: vista previa → el docente oye la canción con el reproductor de YouTube/Spotify… guardado (la misma que verá el estudiante) -->
              @if (embed(); as src) {
                <iframe
                  class="w-full max-w-2xl rounded-xl border border-border"
                  [class.aspect-video]="!compact(song.embedUrl)"
                  [style.height.px]="compact(song.embedUrl) ? 160 : null"
                  [src]="src"
                  [title]="song.title"
                  allow="autoplay; encrypted-media; clipboard-write; picture-in-picture; fullscreen"
                  referrerpolicy="strict-origin-when-cross-origin"
                ></iframe>
              }
            }
            <aula-lyrics-editor
              #lyricsEditor
              [lines]="song?.lines ?? []"
              [language]="song?.language ?? 'en'"
              [busy]="music.busy()"
              [labels]="wz"
              [initial]="music.pendingLyrics()"
              (loadLyrics)="loadLyrics($event.lyrics, $event.auto, $event.translations, $event.ipas)"
              (save)="saveLyricLines($event)"
            />
            <!-- [2026-10-24]: aviso concreto (todo falló / faltan algunos versos) + reintento SOLO de lo que falta -->
            <!-- [2026-10-27]: progreso de las tandas (NestJS responde por trozos acotados en tiempo → ya no se corta el BFF) -->
            @if (music.enrichProgress(); as p) {
              <p role="status" class="flex items-center gap-2 rounded-xl bg-tone-info-soft p-3 text-tone-info">
                <aula-icon name="hourglass" class="animate-spin" /> {{ i18n.fmt(wz.enrichProgress, { done: p.done, total: p.total }) }}
                <span class="ml-auto font-mono text-xs">{{ elapsed(p.since) }}</span>
              </p>
            } @else if (enrichDone()) {
              <p role="status" class="rounded-xl bg-tone-success-soft p-3 text-tone-success">✓ {{ wz.enrichDone }}</p>
            }
            @if (enrichNotice(); as notice) {
              <p role="status" class="rounded-xl bg-tone-warning-soft p-3 text-tone-warning">
                <aula-icon name="triangle-alert" />
                {{ notice === 'unavailable' ? wz.enrichUnavailable : notice === 'failed' ? wz.enrichFailed : i18n.fmt(wz.enrichPartial, { n: pending() }) }}
              </p>
            }
            @if (pending() > 0) {
              <div class="flex flex-wrap items-center gap-2 rounded-xl border border-border p-3 text-sm">
                <span>{{ i18n.fmt(wz.pendingLines, { n: pending() }) }}</span>
                <button type="button" class="btn btn-outline btn-sm" [disabled]="music.busy()" (click)="retryEnrich()">
                  <aula-icon name="refresh" /> {{ wz.retryEnrich }}
                </button>
              </div>
            }
            <div class="flex flex-wrap justify-end gap-2">
              <button type="button" class="btn btn-ghost" (click)="step.set(0)">{{ wz.prev }}</button>
              <button type="button" class="btn btn-primary" [disabled]="music.busy()" (click)="nextFromLyrics()">{{ wz.next }}</button>
            </div>
          </section>
        }
        @case (2) {
          <section class="space-y-4" aria-labelledby="step-3">
            <h2 id="step-3" class="title-section">{{ wz.steps[2] }}</h2>
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
            } @else if (song?.embedUrl) {
              <!-- [2026-11-05]: con reproductor externo no hay <audio> que marcar → se explica cómo se sincroniza -->
              <p class="rounded-xl bg-tone-brand-soft p-3 text-sm">{{ wz.embedSync }}</p>
            } @else {
              <p class="rounded-xl bg-tone-warning-soft p-3 text-tone-warning">
                {{ tx.player.noAudio }}
              </p>
            }
            <!-- [2026-11-13]: acciones a la derecha (Retirar con icono a la izquierda) · botones sin iconos ni flechas -->
            <div class="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
              @if (song) {
                <button type="button" class="btn btn-ghost mr-auto text-tone-danger" [disabled]="music.busy()" (click)="withdraw()">
                  <aula-icon name="trash-2" /> {{ wz.withdraw }}
                </button>
              }
              <button type="button" class="btn btn-ghost" (click)="step.set(1)">{{ wz.prev }}</button>
              <button type="button" class="btn btn-ghost" (click)="cancel()">{{ wz.cancel }}</button>
              <button type="button" class="btn btn-primary" [disabled]="music.busy()" (click)="finish()">
                {{ wz.finish }}
              </button>
            </div>
          </section>
        }
      }

      <p class="mt-4 font-semibold text-tone-brand" aria-live="polite">{{ notice() }}</p>
      @if (music.actionError()) {
        <p role="alert" class="text-tone-danger">{{ music.actionError() }}</p>
      }
    </aula-card-page>
  `,
})
export default class SongUploadPage {
  protected readonly i18n = inject(I18nService);
  protected readonly music = inject(MusicFacade);
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
  protected readonly titleIpa = signal(''); // [2026-11-10]: glosa del título editable
  protected readonly titleTranslation = signal('');
  protected readonly language = signal<string>('en');
  protected readonly level = signal<string>(''); // [2026-11-16 · RF-148]: '' = se estima de la letra
  protected readonly preset = computed(() => !!pickLanguage(this.idioma())); // [2026-11-04]: el idioma llegó de Gestión · [2026-11-16]: el nivel ya no se pide al crear
  protected readonly license = signal<LicenseValue>({ ...EMPTY_LICENSE });
  // [enrichNotice · 2026-10-24]: 'failed' = el servicio no respondió · 'partial' = faltan algunos versos · null = sin aviso
  // [2026-10-27]: + 'unavailable' = el servicio de IA (FastAPI/Ollama) no respondió a nada ≠ error de red (ese llega como `actionError` del BFF)
  protected readonly enrichNotice = signal<'unavailable' | 'failed' | 'partial' | null>(null);
  protected readonly enrichDone = signal(false); // [2026-11-05]: «IPA y traducción listos» al terminar
  // [elapsed · 2026-11-05]: reloj «m:ss» del proceso de traducción → se ve que sigue trabajando | `now` avanza cada segundo solo mientras hay progreso
  private readonly now = signal(Date.now());
  private readonly clock = setInterval(() => this.music.enrichProgress() && this.now.set(Date.now()), 1000);
  protected elapsed(since: number): string {
    const s = Math.max(0, Math.round((this.now() - since) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  // [blockers]: lo que falta para enviar/publicar (del servidor o deducido) | `computed` (signals): se recalcula al recargar la canción
  protected readonly blockers = computed<SongBlocker[]>(() => {
    const s = this.id() ? this.music.song.data() : null;
    return s ? publishBlockers(s) : [];
  });
  // [pending]: versos no revisados sin IPA o sin traducción (español no se traduce) → ofrece «Completar IPA y traducción»
  protected readonly pending = computed(() => {
    const s = this.id() ? this.music.song.data() : null;
    return s ? s.lines.filter((l) => !l.ipa || (s.language !== 'es' && !l.translation)).length : 0; // [2026-11-06]: también versos manuales (= `lacks` de NestJS)
  });
  protected readonly proposal = signal<LineTiming[] | null>(null);
  protected readonly notice = signal('');
  private readonly lyricsImport = inject(LyricsImportService);
  private readonly sanitizer = inject(DomSanitizer);
  // [embed · 2026-11-04]: reproductor guardado (solo orígenes permitidos: SongSchema.embedUrl ya los filtra) | `bypassSecurityTrustResourceUrl`: [src] de <iframe>
  protected readonly embed = computed(() => {
    const url = this.music.song.data()?.embedUrl;
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });
  // [compact]: Spotify, SoundCloud… son barras de audio (sin vídeo) → alto fijo (= song-player.page)
  protected compact(url: string | null): boolean {
    return !!url && /spotify|soundcloud|deezer|apple/.test(url);
  }
  protected readonly importingLyrics = signal(false); // [2026-10-24]: leyendo la letra de una página pegada en el campo del audio
  protected readonly importError = signal('');
  protected readonly canCreate = computed(
    () => this.title().trim().length >= 2 && !licenseProblem(this.license()),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => clearInterval(this.clock));
    effect(() => {
      const id = this.id();
      if (!id) return;
      void this.music.loadSong(id);
      void this.music.loadLinkRules(); // [2026-10-24]: reglas del enlace del audio (una vez; fail-soft)
    });
    // [2026-10-25]: la canción ya existe → paso 2 «Audio y letra» (los datos ya se guardaron) | solo depende de `id` (no de lo que lea loadSong)
    effect(() => {
      if (this.id()) untracked(() => this.step.set(1));
    });
    // [Auto-alineación · 2026-11-06]: audio subido + letra SIN tiempos → al abrir «Sincronización» se pide la alineación (Whisper) y se guarda como «auto»
    // → en el reproductor la letra sigue a la VOZ (no a la intro instrumental) sin que el docente marque nada | una vez por canción; lo manual nunca se pisa
    effect(() => {
      const s = this.id() ? this.music.song.data() : null;
      if (this.step() !== 2 || !s?.audioKey || !s.lines.length || s.lines.some((l) => l.startS != null) || this.aligned.has(s.id)) return;
      this.aligned.add(s.id);
      untracked(() => void this.autoAlign(s.id));
    });
    // [2026-11-10]: canción existente → el formulario de datos arranca con lo guardado
    effect(() => {
      const s = this.id() ? this.music.song.data() : null;
      if (!s) return;
      untracked(() => {
        this.title.set(s.title);
        this.artist.set(s.artist);
        this.level.set(s.level);
        this.license.set({ ...s.license } as LicenseValue);
        this.titleIpa.set(s.titleIpa);
        this.titleTranslation.set(s.titleTranslation);
      });
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

  protected async saveDetails(): Promise<void> {
    if (!(await this.music.updateSong(this.id()!, {
      title: this.title().trim(),
      artist: this.artist().trim(),
      level: this.level() || undefined, // Sin elegir → se conserva el actual (o se estima de la letra)
      license: this.license(),
      titleIpa: this.titleIpa().trim(),
      titleTranslation: this.titleTranslation().trim(),
    }))) return;
    this.notice.set(this.i18n.t().music.wizard.saved);
  }

  protected async create(): Promise<void> {
    this.music.pendingLyrics.set(''); // [2026-11-06]: una canción nueva no hereda la letra de la anterior
    const song = await this.music.createSong({
      title: this.title().trim(),
      artist: this.artist().trim() || undefined,
      language: this.language(),
      level: this.level() || undefined, // [RF-148]: sin nivel → NestJS lo estima al cargar la letra
      license: this.license(),
    });
    if (!song) return;
    await this.returnTo.go(['/musica/subir', song.id]); // Con id: se habilitan audio, letra y sincronización
  }

  // [importLyricsFrom · 2026-10-24]: el docente pegó una página de letras en el campo del audio → se lee la letra y se abre el paso «Letra» para revisarla (no se guarda sola)
  protected async importLyricsFrom(url: string): Promise<void> {
    this.importingLyrics.set(true);
    this.importError.set('');
    try {
      const { text } = await this.lyricsImport.fromUrl(url, this.music.song.data()?.language ?? this.language());
      if (!text.trim()) return; // [2026-11-06]: el vídeo no trae letra → sin aviso; el docente la escribe
      this.music.pendingLyrics.set(text); // El editor de letra la muestra como borrador (`initial`)
      this.notice.set(this.i18n.t().music.wizard.audioLink.lyricsImported);
    } catch (err) {
      this.importError.set(err instanceof Error ? err.message : String(err)); // ApiError ya trae un mensaje accionable (anti-bots, 404…)
    } finally {
      this.importingLyrics.set(false);
    }
  }

  // [nextFromLyrics · 2026-11-10]: la letra que quedó en el área (importada del enlace o escrita) se guarda al avanzar → antes se perdía y publicar decía «Falta la letra»
  private readonly lyricsEditor = viewChild<LyricsEditorComponent>('lyricsEditor');
  protected async nextFromLyrics(): Promise<void> {
    const p = this.lyricsEditor()?.pendingLoad();
    if (p) await this.loadLyrics(p.lyrics, p.auto, p.translations, p.ipas); // Ya pasa al paso 3 si la letra quedó lista
    else this.step.set(2);
  }

  // [goTo · 2026-11-10 · «Wind Of Change» quedó con 0 versos]: saltar de paso con las pestañas también guarda la letra pendiente (el editor desaparece al cambiar de paso)
  protected async goTo(i: number): Promise<void> {
    const p = this.step() === 1 && i !== 1 ? this.lyricsEditor()?.pendingLoad() : null;
    if (p) await this.loadLyrics(p.lyrics, p.auto, p.translations, p.ipas);
    this.step.set(i);
  }

  protected async loadLyrics(lyrics: string, auto: boolean, translations = '', ipas = ''): Promise<void> {
    // [2026-11-06 · Manual]: letra + IPA + traducción escritos a mano → se guardan TAL CUAL, sin IA (antes se rellenaba lo vacío y se pisaba lo manual)
    // Bug «la crea sin letra ni traducción»: se emparejaba con las líneas viejas de la canción (aún sin recargar) → ahora con las que devuelve el servidor
    if (!auto) {
      const lines = await this.music.loadManualLyrics(this.id()!, lyrics);
      if (!lines) return;
      this.music.pendingLyrics.set('');
      const patches = manualLines(lyrics, ipas, translations, lines);
      if (patches.length && !(await this.music.saveLines(this.id()!, patches))) return;
      await this.music.loadSong(this.id()!);
      this.enrichNotice.set(null);
      this.notice.set(this.i18n.t().music.wizard.saved);
      this.step.set(2);
      return;
    }
    let r = await this.music.loadLyrics(this.id()!, lyrics, auto);
    if (r) this.music.pendingLyrics.set('');
    // [2026-10-25]: versos sin IPA/traducción (el LLM tardó) → un reintento automático de SOLO esos versos antes de avisar (no si la IA está caída: no insistir)
    if (auto && r && !r.enriched && r.missing > 0 && !r.unavailable) r = (await this.music.retryEnrich(this.id()!)) ?? r;
    this.enrichNotice.set(auto && r ? this.noticeOf(r) : null); // En modo manual no se pidió IPA → no es un fallo
    this.enrichDone.set(!!(auto && r?.enriched));
    if (r && (!auto || r.enriched)) this.step.set(2); // Letra lista → siguiente paso de la línea de tiempo (antes se quedaba en «Letra»)
  }

  // [retryEnrich · 2026-10-24]: vuelve a pedir IPA y traducción solo de los versos que faltan
  protected async retryEnrich(): Promise<void> {
    this.enrichDone.set(false);
    const r = await this.music.retryEnrich(this.id()!);
    if (r) this.enrichNotice.set(this.noticeOf(r));
    this.enrichDone.set(!!r?.enriched);
  }

  // [noticeOf]: resultado → aviso | Función pura sobre el estado actual (líneas recargadas)
  private noticeOf(r: { enriched: boolean; missing: number; unavailable?: boolean }): 'unavailable' | 'failed' | 'partial' | null {
    if (r.enriched) return null;
    if (r.unavailable) return 'unavailable';
    const total = this.music.song.data()?.lines.length ?? 0;
    return r.missing > 0 && r.missing < total ? 'partial' : 'failed';
  }

  // [saveLyricLines · 2026-11-06]: «Guardar» de la tabla → se guarda lo escrito (lo vacío NO se rellena solo: para eso está «Completar IPA y traducción»)
  protected async saveLyricLines(lines: LinePatch[]): Promise<void> {
    await this.saveLines(lines);
  }

  protected async saveLines(lines: LinePatch[], source?: 'manual' | 'auto'): Promise<void> {
    if (await this.music.saveLines(this.id()!, lines, source)) {
      this.notice.set(this.i18n.t().music.wizard.saved);
      this.proposal.set(null);
    }
  }

  private readonly aligned = new Set<string>();
  private async autoAlign(id: string): Promise<void> {
    this.notice.set(this.i18n.t().music.wizard.aligning);
    const p = await this.music.proposeTimings(id);
    const lines = (p ?? []).filter((t) => t.start != null).map((t) => ({ id: t.id, startS: t.start!, endS: t.end ?? t.start! + 2 }));
    if (lines.length) await this.saveLines(lines, 'auto');
    else this.notice.set('');
  }

  protected async propose(): Promise<void> {
    this.proposal.set(await this.music.proposeTimings(this.id()!));
  }

  // [finish · 2026-10-25 → Fix 2026-10-30]: «Guardar» del último paso → todo ya está en el servidor → al BORRADOR para revisar y publicar (página de Next.js: navegación completa), como el resto de actividades
  protected finish(): void {
    this.notice.set(this.i18n.t().music.wizard.finished);
    window.location.assign(`/admin/activities/ver/music/${encodeURIComponent(this.id()!)}`); // `location.assign` (DOM): sale de la SPA Angular
  }

  protected cancel(): void {
    this.music.pendingLyrics.set('');
    this.returnTo.leave('/musica');
  }

  protected async withdraw(): Promise<void> {
    this.music.pendingLyrics.set('');
    if (await this.music.withdraw(this.id()!)) await this.returnTo.leave('/musica');
  }
}
