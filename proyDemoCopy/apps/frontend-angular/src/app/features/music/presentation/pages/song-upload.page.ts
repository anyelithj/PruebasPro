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
import { Router } from '@angular/router';
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
import {
  MAX_AUDIO_MB,
  publishBlockers,
  SONG_BLOCKERS,
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

      <!-- [2026-10-26]: requisitos para publicar arriba, junto a los pasos (antes iban debajo de los botones y confundían) -->
      @if (song && song.status !== 'published' && blockers().length) {
        @let ck = wz.checklist;
        <section class="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-tone-warning-line bg-tone-warning-soft px-3 py-2 text-xs" aria-label="{{ ck.title }}">
          <strong>{{ ck.title }}:</strong>
          @for (b of requirements; track b) {
            @let missing = blockers().includes(b);
            <span class="inline-flex items-center gap-1" [class.text-tone-warning]="missing">
              <aula-icon [name]="missing ? 'circle-x' : 'circle-check'" [label]="missing ? ck.todo : ck.done" />
              @if (missing && stepOf[b] !== null) {
                <button type="button" class="underline" (click)="step.set(stepOf[b]!)">{{ ck[b] }}</button>
              } @else {
                {{ ck[b] }}
              }
            </span>
          }
        </section>
      }

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
              <!-- [2026-10-24 · Letra con IA]: borrador ORIGINAL por idioma, nivel y tema; se guarda junto con la canción -->
              <section class="space-y-2 rounded-xl border border-dashed border-border p-3" aria-labelledby="ai-lyrics">
                <h3 id="ai-lyrics" class="flex items-center gap-2 text-sm font-bold">
                  <aula-icon name="sparkles" /> {{ wz.aiTitle }}
                </h3>
                <p class="text-xs text-muted-foreground">{{ wz.aiHint }}</p>
                <!-- [2026-10-25]: sin campo «tema» → el título y el autor de arriba ya dicen de qué va la canción -->
                <!-- [2026-10-26]: con autor = canción real → la IA inventaba otra letra con el mismo título («Dirty Diana») → se pide importar la letra real -->
                @if (artist().trim()) {
                  <p class="rounded-lg bg-tone-warning-soft p-2 text-xs text-tone-warning">{{ wz.aiRealSong }}</p>
                }
                <button type="button" class="btn btn-outline" [disabled]="title().trim().length < 2 || !!artist().trim() || music.busy()" (click)="generate()">
                  <aula-icon name="sparkles" /> {{ wz.aiGenerate }}
                </button>
                @if (generating()) {
                  <p class="text-xs text-muted-foreground" aria-live="polite">
                    <aula-icon name="hourglass" /> {{ wz.aiGenerating }}
                  </p>
                }
                @if (aiLyrics()) {
                  <p class="rounded-lg bg-tone-warning-soft p-2 text-xs font-semibold text-tone-warning">
                    <aula-icon name="triangle-alert" /> {{ i18n.t().common.aiReview }}
                  </p>
                  <label class="block text-xs font-semibold text-muted-foreground">
                    {{ wz.aiLyrics }}
                    <textarea
                      class="control mt-1 min-h-40 w-full font-mono text-sm"
                      maxlength="12000"
                      [attr.lang]="language()"
                      [value]="aiLyrics()"
                      (input)="aiLyrics.set($any($event.target).value)"
                    ></textarea>
                  </label>
                  <p class="text-xs text-muted-foreground">{{ wz.aiWillLoad }}</p>
                }
              </section>
              <div class="flex flex-wrap gap-2">
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
              <div class="flex flex-wrap gap-2">
                <button type="button" class="btn btn-ghost" (click)="cancel()">{{ wz.cancel }}</button>
                <button type="button" class="btn btn-primary" (click)="step.set(1)">{{ wz.next }} →</button>
              </div>
            }
          </section>
        }
        @case (1) {
          <section class="space-y-4" aria-labelledby="step-2">
            <h2 id="step-2" class="text-lg font-extrabold">{{ wz.steps[1] }}</h2>
            @if (song) {
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
                [linkRules]="music.linkRules()"
                [linkLabels]="wz.audioLink"
                [importingLyrics]="importingLyrics()"
                (importLyrics)="importLyricsFrom($event)"
              />
              @if (importError()) {
                <p role="alert" class="text-xs font-semibold text-tone-danger">{{ importError() }}</p>
              }
            }
            <aula-lyrics-editor
              [lines]="song?.lines ?? []"
              [language]="song?.language ?? 'en'"
              [busy]="music.busy()"
              [labels]="wz"
              [initial]="music.pendingLyrics()"
              (loadLyrics)="loadLyrics($event.lyrics, $event.auto)"
              (save)="saveLines($event)"
            />
            <!-- [2026-10-24]: aviso concreto (todo falló / faltan algunos versos) + reintento SOLO de lo que falta -->
            @if (enrichNotice(); as notice) {
              <p role="status" class="rounded-xl bg-tone-warning-soft p-3 text-sm text-tone-warning">
                <aula-icon name="triangle-alert" />
                {{ notice === 'failed' ? wz.enrichFailed : i18n.fmt(wz.enrichPartial, { n: pending() }) }}
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
            <div class="flex flex-wrap gap-2">
              <button type="button" class="btn btn-ghost" (click)="step.set(0)">← {{ wz.prev }}</button>
              <button type="button" class="btn btn-primary" (click)="step.set(2)">{{ wz.next }} →</button>
            </div>
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
            <div class="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <button type="button" class="btn btn-ghost" (click)="step.set(1)">← {{ wz.prev }}</button>
              <button type="button" class="btn btn-ghost" (click)="cancel()">{{ wz.cancel }}</button>
              <button type="button" class="btn btn-primary" [disabled]="music.busy()" (click)="finish()">
                <aula-icon name="save" /> {{ wz.finish }}
              </button>
              <!-- Enviar a revisión solo cuando ya no falta nada (antes aparecía bloqueado y confundía) -->
              @if (song && (song.status === 'draft' || song.status === 'rejected') && !blockers().length) {
                <button type="button" class="btn btn-outline" [disabled]="music.busy()" (click)="submit()">
                  <aula-icon name="send" /> {{ wz.submit }}
                </button>
              }
              @if (song && admin() && song.status === 'review' && !blockers().length) {
                <button type="button" class="btn btn-outline" [disabled]="music.busy()" (click)="decide('published')">✓ {{ tx.publish }}</button>
                <input class="control h-10 w-56 text-sm" [attr.aria-label]="tx.rejectReason" [placeholder]="tx.rejectReason" (input)="reason.set($any($event.target).value)" />
                <button type="button" class="btn btn-outline" [disabled]="music.busy() || !reason().trim()" (click)="decide('rejected')">✕ {{ tx.reject }}</button>
              }
              @if (song) {
                <button type="button" class="btn btn-ghost ml-auto text-tone-danger" [disabled]="music.busy()" (click)="withdraw()">
                  <aula-icon name="trash-2" /> {{ wz.withdraw }}
                </button>
              }
            </div>
          </section>
        }
      }

      <p class="mt-4 text-sm font-semibold text-tone-brand" aria-live="polite">{{ notice() }}</p>
      @if (music.actionError()) {
        <p role="alert" class="text-sm text-tone-danger">{{ music.actionError() }}</p>
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
  // [enrichNotice · 2026-10-24]: 'failed' = el servicio no respondió · 'partial' = faltan algunos versos · null = sin aviso
  protected readonly enrichNotice = signal<'failed' | 'partial' | null>(null);
  protected readonly aiLyrics = signal('');
  protected readonly generating = signal(false);
  protected readonly requirements = SONG_BLOCKERS;
  // [stepOf]: paso del asistente donde se completa cada requisito (la licencia se declara al crear → sin atajo) | `Record` (TS) exhaustivo
  protected readonly stepOf: Readonly<Record<SongBlocker, number | null>> = { license: null, audio: 1, lyrics: 1 };
  // [blockers]: lo que falta para enviar/publicar (del servidor o deducido) | `computed` (signals): se recalcula al recargar la canción
  protected readonly blockers = computed<SongBlocker[]>(() => {
    const s = this.id() ? this.music.song.data() : null;
    return s ? publishBlockers(s) : [];
  });
  // [pending]: versos no revisados sin IPA o sin traducción (español no se traduce) → ofrece «Completar IPA y traducción»
  protected readonly pending = computed(() => {
    const s = this.id() ? this.music.song.data() : null;
    return s ? s.lines.filter((l) => !l.reviewed && (!l.ipa || (s.language !== 'es' && !l.translation))).length : 0;
  });
  protected readonly proposal = signal<LineTiming[] | null>(null);
  protected readonly notice = signal('');
  protected readonly reason = signal('');
  private readonly lyricsImport = inject(LyricsImportService);
  protected readonly importingLyrics = signal(false); // [2026-10-24]: leyendo la letra de una página pegada en el campo del audio
  protected readonly importError = signal('');
  protected readonly admin = computed(() => this.session.hasRole('ADMIN'));
  protected readonly canCreate = computed(
    () => this.title().trim().length >= 2 && !licenseProblem(this.license()),
  );

  constructor() {
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
    if (!song) return;
    // [2026-10-24 · Letra con IA]: mismo camino que una letra pegada (POST /lines → IPA y traducción); si falla queda en `pendingLyrics` y el paso «Letra» la muestra
    const lyrics = this.aiLyrics().trim();
    if (lyrics) {
      this.music.pendingLyrics.set(lyrics);
      if (await this.music.loadLyrics(song.id, lyrics, true)) this.music.pendingLyrics.set('');
    }
    await this.returnTo.go(['/musica/subir', song.id]); // Con id: se habilitan audio, letra y sincronización
  }

  // [importLyricsFrom · 2026-10-24]: el docente pegó una página de letras en el campo del audio → se lee la letra y se abre el paso «Letra» para revisarla (no se guarda sola)
  protected async importLyricsFrom(url: string): Promise<void> {
    this.importingLyrics.set(true);
    this.importError.set('');
    try {
      const { text } = await this.lyricsImport.fromUrl(url, this.music.song.data()?.language ?? this.language());
      this.music.pendingLyrics.set(text); // El editor de letra la muestra como borrador (`initial`)
      this.notice.set(this.i18n.t().music.wizard.audioLink.lyricsImported);
    } catch (err) {
      this.importError.set(err instanceof Error ? err.message : String(err)); // ApiError ya trae un mensaje accionable (anti-bots, 404…)
    } finally {
      this.importingLyrics.set(false);
    }
  }

  // [generate · 2026-10-24]: pide el borrador a NestJS (Ollama local); propone título y titular de la licencia si están vacíos (el docente confirma)
  protected async generate(): Promise<void> {
    this.generating.set(true);
    const draft = await this.music.draftLyrics({
      language: this.language(),
      level: this.level(),
      topic: this.title().trim(), // [2026-10-26]: solo el título como tema (sin autor: la IA no imita canciones reales)
      title: this.title().trim() || undefined,
    });
    this.generating.set(false);
    if (!draft) return; // El error ya se ve en `music.actionError`
    this.aiLyrics.set(draft.lyrics);
    if (!this.title().trim()) this.title.set(draft.title);
    if (!this.license().holder.trim())
      this.license.update((l) => ({ ...l, type: 'own_work', holder: this.i18n.t().music.wizard.aiHolder }));
  }

  protected async loadLyrics(lyrics: string, auto: boolean): Promise<void> {
    let r = await this.music.loadLyrics(this.id()!, lyrics, auto);
    if (r) this.music.pendingLyrics.set('');
    // [2026-10-25]: versos sin IPA/traducción (el LLM tardó) → un reintento automático de SOLO esos versos antes de avisar
    if (auto && r && !r.enriched && r.missing > 0) r = (await this.music.retryEnrich(this.id()!)) ?? r;
    this.enrichNotice.set(auto && r ? this.noticeOf(r) : null); // En modo manual no se pidió IPA → no es un fallo
    if (r && (!auto || r.enriched)) this.step.set(2); // Letra lista → siguiente paso de la línea de tiempo (antes se quedaba en «Letra»)
  }

  // [retryEnrich · 2026-10-24]: vuelve a pedir IPA y traducción solo de los versos que faltan
  protected async retryEnrich(): Promise<void> {
    const r = await this.music.retryEnrich(this.id()!);
    if (r) this.enrichNotice.set(this.noticeOf(r));
  }

  // [noticeOf]: resultado → aviso | Función pura sobre el estado actual (líneas recargadas)
  private noticeOf(r: { enriched: boolean; missing: number }): 'failed' | 'partial' | null {
    if (r.enriched) return null;
    const total = this.music.song.data()?.lines.length ?? 0;
    return r.missing > 0 && r.missing < total ? 'partial' : 'failed';
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

  // [finish · 2026-10-25]: «Guardar» del último paso → todo ya está en el servidor (borrador) → vuelve a Gestión
  protected finish(): void {
    this.notice.set(this.i18n.t().music.wizard.finished);
    this.returnTo.leave('/musica');
  }

  protected cancel(): void {
    this.returnTo.leave('/musica');
  }

  protected async withdraw(): Promise<void> {
    if (await this.music.withdraw(this.id()!)) await this.returnTo.leave('/musica');
  }
}
