import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { SpeechSynthesisService } from '@core/audio/speech-synthesis.service';
import { I18nService } from '@core/i18n/i18n.service';
import { ReturnLinkComponent } from '@core/layout/return-to';
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { ReadAloudPlayer, type ReadingRate } from '../../application/read-aloud.player';
import { ReadingFacade } from '../../application/reading.facade';
import { paragraphs, type ReadingSentence } from '../../domain/models/reading';
import { ReadingSentenceComponent } from '../components/reading-sentence.component';
// [ReadingReaderPage · Presentación · Lectura · 2026-10-25]: /lectura/:id — el texto original con IPA y traducción a elección, lectura en voz alta frase a frase con la palabra activa resaltada,
// velocidad 0,75x/1x, repetir frase, marcador de lectura (se guarda solo al avanzar y a mano con «Poner marcador aquí») y descarga PDF/TXT
// [Patrón]: Container (smart) + Facade (ReadingFacade) + State Machine (ReadAloudPlayer) | [Principio]: SRP (la frase la pinta ReadingSentenceComponent) + DRY (ServerAudioService, ReturnLink, CardPage) | [Paradigma]: Declarativo + Reactivo
// [A11y]: barra role="toolbar" con nombres accesibles, interruptores con aria-pressed, posición y avisos con aria-live, `lang` del idioma en el texto · [Responsive]: la barra se ajusta en varias líneas en móvil y queda fija arriba al desplazarse

@Component({
  selector: 'aula-reading-reader-page',
  imports: [CardPageTemplate, SpinnerComponent, IconComponent, ReturnLinkComponent, ReadingSentenceComponent],
  providers: [ReadAloudPlayer], // Estado de reproducción propio de esta pantalla
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().reading;
    @let d = reading.text.data();
    <aula-card-page [heading]="d?.title ?? tx.title" [subtitle]="d ? i18n.languageName(d.language) + ' · ' + d.level + ' · ' + tx.genres[d.genre] : ''">
      <aula-return-link pageBack fallback="/lectura" [label]="tx.backToList" />
      @if (d?.editable) {
        <div pageActions>
          <!-- <a href>: el editor de frases es una página de Next.js (Gestión) -->
          <a class="btn btn-outline btn-sm" [href]="'/admin/activities/lectura/' + d!.id"><aula-icon name="pencil" /> {{ tx.edit }}</a>
        </div>
      }
      @switch (reading.text.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <p role="alert" class="text-sm text-tone-danger">{{ reading.text.error() }}</p>
        }
      }
      @if (d) {
        @if (d.status === 'draft') {
          <p class="mb-3 rounded-xl bg-tone-warning-soft p-3 text-sm text-tone-warning"><aula-icon name="triangle-alert" /> {{ tx.draft }}</p>
        }
        @if (d.summary) {
          <p lang="es" class="mb-4 text-sm text-muted-foreground">{{ d.summary }}</p>
        }
        @if (d.progress && d.progress.sentence > 0 && player.state() === 'idle') {
          <div role="status" class="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-tone-brand-line bg-tone-brand-soft p-3 text-sm">
            <aula-icon name="bookmark" class="text-tone-brand" />
            <span class="flex-1">{{ i18n.fmt(tx.resume, { n: d.progress.sentence + 1 }) }}</span>
            <button type="button" class="btn btn-primary btn-sm" (click)="player.play(d.progress.sentence)"><aula-icon name="play" /> {{ tx.continue }}</button>
            <button type="button" class="btn btn-ghost btn-sm" (click)="restart()"><aula-icon name="refresh" /> {{ tx.restart }}</button>
          </div>
        }

        <!-- ── Barra de lectura (fija arriba al desplazar) ── -->
        <div role="toolbar" [attr.aria-label]="tx.controls" class="sticky top-0 z-10 mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/95 p-2 shadow-sm backdrop-blur">
          <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="tx.previous" [disabled]="player.sentence() === 0" (click)="player.seek(player.sentence() - 1)">‹</button>
          <button type="button" class="btn btn-primary btn-sm min-w-28" (click)="player.toggle()" [attr.aria-pressed]="player.state() === 'playing'">
            <aula-icon [name]="player.state() === 'playing' ? 'pause' : 'play'" /> {{ player.state() === 'playing' ? tx.pause : tx.play }}
          </button>
          <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="tx.next" [disabled]="player.sentence() >= d.sentences.length - 1" (click)="player.seek(player.sentence() + 1)">›</button>
          <button type="button" class="btn btn-sm" [class]="player.repeat() ? 'btn-primary' : 'btn-outline'" [attr.aria-pressed]="player.repeat()" (click)="player.repeat.set(!player.repeat())">
            <aula-icon name="repeat" /> {{ tx.repeat }}
          </button>
          <span class="inline-flex items-center gap-1" role="group" [attr.aria-label]="tx.speed">
            <aula-icon name="turtle" class="text-muted-foreground" />
            @for (r of rates; track r) {
              <button type="button" class="btn btn-sm" [class]="player.rate() === r ? 'btn-primary' : 'btn-outline'" [attr.aria-pressed]="player.rate() === r" (click)="player.setRate(r)">{{ r === 1 ? '1x' : '0,75x' }}</button>
            }
          </span>
          <span class="inline-flex items-center gap-1" role="group" [attr.aria-label]="tx.show">
            <button type="button" class="btn btn-sm" [class]="showIpa() ? 'btn-primary' : 'btn-outline'" [attr.aria-pressed]="showIpa()" (click)="showIpa.set(!showIpa())">{{ tx.ipa }}</button>
            @if (d.language !== 'es') {
              <button type="button" class="btn btn-sm" [class]="showTranslation() ? 'btn-primary' : 'btn-outline'" [attr.aria-pressed]="showTranslation()" (click)="showTranslation.set(!showTranslation())">
                <aula-icon name="languages" /> {{ tx.translation }}
              </button>
            }
          </span>
          <button type="button" class="btn btn-ghost btn-sm" (click)="bookmarkHere()"><aula-icon name="bookmark" /> {{ tx.bookmarkHere }}</button>
          <details class="relative">
            <summary class="btn btn-ghost btn-sm list-none"><aula-icon name="download" /> {{ tx.download }}</summary>
            <ul class="absolute right-0 z-20 mt-1 w-64 space-y-1 rounded-xl border border-border bg-card p-2 text-sm shadow-lg">
              <li><a class="block rounded px-2 py-1 hover:bg-muted" [href]="reading.exportUrl(d.id, 'pdf', both)" download>{{ tx.downloadPdf }}</a></li>
              <li><a class="block rounded px-2 py-1 hover:bg-muted" [href]="reading.exportUrl(d.id, 'txt', both)" download>{{ tx.downloadTxt }}</a></li>
              <li><a class="block rounded px-2 py-1 hover:bg-muted" [href]="reading.exportUrl(d.id, 'txt', none)" download>{{ tx.downloadPlain }}</a></li>
            </ul>
          </details>
          <span class="ml-auto text-xs text-muted-foreground" aria-live="polite">
            {{ i18n.fmt(tx.position, { n: player.sentence() + 1, total: d.sentences.length }) }}
            @if (player.state() === 'playing' && player.sync(); as s) {
              · {{ tx.sync[s] }}
            }
          </span>
        </div>

        <p class="sr-only" aria-live="polite">{{ notice() }}</p>
        @if (notice()) {
          <p class="mb-3 text-sm font-semibold text-tone-brand" aria-hidden="true">{{ notice() }}</p>
        }

        <!-- ── Texto ── -->
        <article [attr.lang]="d.language" class="space-y-4 text-lg leading-relaxed" [class.font-serif]="d.genre !== 'news'">
          @for (para of paras(); track $index) {
            <p [class]="d.genre === 'poem' ? 'space-y-0' : ''">
              @for (s of para; track s.id) {
                <aula-reading-sentence
                  [class.block]="d.genre === 'poem'"
                  [sentence]="s"
                  [tokens]="player.tokensOf(s.position)"
                  [language]="d.language"
                  [active]="player.sentence() === s.position && (player.state() !== 'idle' || player.word() >= 0)"
                  [activeWord]="player.word()"
                  [bookmarkWord]="d.progress && d.progress.sentence === s.position ? d.progress.word : -1"
                  [bookmarkLabel]="tx.bookmark"
                  [showIpa]="showIpa()"
                  [showTranslation]="showTranslation()"
                  [accent]="speech.accent() === 'us' ? 'us' : 'uk'"
                  (pick)="pick(s, $event)"
                />
              }
            </p>
          }
        </article>
        @if (finished()) {
          <p role="status" class="mt-6 text-lg font-extrabold text-tone-brand"><aula-icon name="party-popper" /> {{ tx.finished }}</p>
        }
      }
    </aula-card-page>
  `,
})
export default class ReadingReaderPage {
  protected readonly i18n = inject(I18nService);
  protected readonly reading = inject(ReadingFacade);
  protected readonly player = inject(ReadAloudPlayer);
  protected readonly speech = inject(SpeechSynthesisService);
  readonly id = input<string>(); // /lectura/:id (withComponentInputBinding)
  protected readonly rates: readonly ReadingRate[] = [0.75, 1];
  protected readonly both = ['translation', 'ipa'] as const;
  protected readonly none = [] as const;
  protected readonly showIpa = signal(false);
  protected readonly showTranslation = signal(false);
  protected readonly notice = signal('');
  protected readonly finished = signal(false);
  protected readonly paras = computed(() => paragraphs(this.reading.text.data()?.sentences ?? []));

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) void this.reading.loadText(id);
    });
    // [Cargar el lector]: al llegar el texto se preparan las frases y se coloca en el marcador guardado
    let loaded = ''; // Texto ya cargado en el reproductor → guardar el marcador (que actualiza `data`) no reinicia la lectura
    effect(() => {
      const d = this.reading.text.data();
      if (!d || d.id !== this.id() || d.id === loaded) return;
      loaded = d.id;
      untracked(() => this.player.load(d.sentences.map((s) => s.text), d.language, d.progress?.sentence ?? 0)); // `untracked`: el reproductor no se vuelve dependencia del effect
    });
    // [Marcador automático]: cada frase nueva que empieza a sonar se guarda (idempotente; un fallo de red no corta la lectura)
    this.player.onSentence = (i) => {
      this.finished.set(false);
      const d = this.reading.text.data();
      if (d) void this.reading.saveProgress(d.id, { sentence: i, word: 0, finished: false });
      if (this.player.state() === 'playing') document.getElementById(`sentence-${i}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); // Sigue la lectura sin saltos bruscos
    };
    this.player.onFinish = () => {
      const d = this.reading.text.data();
      this.finished.set(true);
      if (d) void this.reading.saveProgress(d.id, { sentence: Math.max(d.sentences.length - 1, 0), word: 0, finished: true });
    };
  }

  // [pick]: clic en una palabra → si suena, salta a esa frase; si no, se coloca ahí (y «Poner marcador aquí» la guarda)
  protected pick(s: ReadingSentence, word: number): void {
    if (this.player.state() === 'playing') this.player.seek(s.position);
    else this.player.seek(s.position, word);
  }

  // [bookmarkHere]: guarda frase y palabra actuales como marcador
  protected async bookmarkHere(): Promise<void> {
    const d = this.reading.text.data();
    if (!d) return;
    const sentence = this.player.sentence();
    const ok = await this.reading.saveProgress(d.id, { sentence, word: Math.max(this.player.word(), 0), finished: false });
    this.notice.set(ok ? this.i18n.fmt(this.i18n.t().reading.bookmarkSaved, { n: sentence + 1 }) : this.i18n.t().common.error);
  }

  protected async restart(): Promise<void> {
    const d = this.reading.text.data();
    if (!d) return;
    await this.reading.resetProgress(d.id);
    this.finished.set(false);
    this.player.seek(0);
    this.player.play(0);
  }
}
