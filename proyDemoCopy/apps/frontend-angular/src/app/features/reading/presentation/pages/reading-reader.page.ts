import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject, input, signal, untracked, viewChild } from '@angular/core';
import { SpeechSynthesisService } from '@core/audio/speech-synthesis.service';
import { DictionaryFacade } from '@core/dictionary/dictionary.facade';
import { I18nService } from '@core/i18n/i18n.service';
import { ReturnLinkComponent } from '@core/layout/return-to';
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { placeWordCard, WordCardComponent, type WordCardPlace } from '@shared/ui/organisms/word-lookup/word-card.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { ReadAloudPlayer } from '../../application/read-aloud.player';
import { ReadingFacade } from '../../application/reading.facade';
import { paragraphs, type ReadingSentence } from '../../domain/models/reading';
import { ReadingSentenceComponent, type WordPick } from '../components/reading-sentence.component';
import { ReadingTranslationPaneComponent } from '../components/reading-translation-pane.component';
import { prefersReducedMotion, scrollIntoBox } from '../scroll-into-box';
// [ReadingReaderPage · Presentación · Lectura · 2026-10-25]: /lectura/:id — el texto original con IPA y traducción a elección, lectura en voz alta frase a frase con la palabra activa resaltada,
// velocidad 0,75x/1x, repetir frase, marcador de lectura (se guarda solo al avanzar y a mano con «Poner marcador aquí») y descarga PDF/TXT
// [Patrón]: Container (smart) + Facade (ReadingFacade) + State Machine (ReadAloudPlayer) | [Principio]: SRP (la frase la pinta ReadingSentenceComponent) + DRY (ServerAudioService, ReturnLink, CardPage) | [Paradigma]: Declarativo + Reactivo
// [A11y]: barra role="toolbar" con nombres accesibles, interruptores con aria-pressed, posición y avisos con aria-live, `lang` del idioma en el texto · [Responsive]: la barra se ajusta en varias líneas en móvil y queda fija arriba al desplazarse
// [2026-10-28 · Dos columnas]: IZQUIERDA el original que lee la voz, DERECHA la traducción al español (nunca en línea) · el resaltado avanza en ambas A LA VEZ (misma `position`)
// y cada columna se desplaza sola a la frase activa (scrollIntoBox; sin animación con prefers-reduced-motion) · en móvil se apilan, cada una con su propio scroll
// [Traducciones que faltan]: NestJS las genera y guarda al leer (`enriching`) y ReadingFacade sondea hasta completarlas → la columna derecha se rellena sola

@Component({
  selector: 'aula-reading-reader-page',
  imports: [CardPageTemplate, SpinnerComponent, IconComponent, ReturnLinkComponent, ReadingSentenceComponent, ReadingTranslationPaneComponent, WordCardComponent],
  providers: [ReadAloudPlayer], // Estado de reproducción propio de esta pantalla
  changeDetection: ChangeDetectionStrategy.OnPush,
  // [Cerrar la ficha]: Esc (el foco vuelve a la palabra), clic fuera o scroll de la ventana | listeners de Angular (se limpian solos)
  host: { '(document:keydown.escape)': 'closeCard(true)', '(document:click)': 'onDocClick($event)', '(window:scroll)': 'closeCard()' },
  template: `
    @let tx = i18n.t().reading;
    @let d = reading.text.data();
    <aula-card-page [heading]="d?.title ?? tx.title" [headingLang]="d?.language ?? ''" [subtitle]="d ? i18n.languageName(d.language) + ' · ' + d.level + ' · ' + tx.genres[d.genre] : ''">
      <aula-return-link pageBack fallback="/lectura" [label]="tx.backToList" />
      <!-- [2026-11-06]: sin «Editar» en la lectura (se edita desde Gestión → Actividades) -->
      @switch (reading.text.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <p role="alert" class="text-tone-danger">{{ reading.text.error() }}</p>
        }
      }
      @if (d) {
        @if (d.status === 'draft') {
          <p class="mb-3 rounded-xl bg-tone-warning-soft p-3 text-tone-warning"><aula-icon name="triangle-alert" /> {{ tx.draft }}</p>
        }
        @if (d.summary) {
          <p lang="es" class="mb-4 text-muted-foreground">{{ d.summary }}</p>
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
          <!-- [2026-11-06]: «🔊 Audio lectura» en su propio renglón; los botones debajo (w-full fuerza el salto en flex-wrap) -->
          <h2 class="title-card w-full">{{ tx.readAloud }}</h2>
          <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="tx.previous" [disabled]="player.sentence() === 0" (click)="player.seek(player.sentence() - 1)">‹</button>
          <button type="button" class="btn btn-primary btn-sm min-w-28" (click)="player.toggle()" [attr.aria-pressed]="player.state() === 'playing'">
            <aula-icon [name]="player.state() === 'playing' ? 'pause' : 'play'" /> {{ player.state() === 'playing' ? tx.pause : tx.play }}
          </button>
          <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="tx.next" [disabled]="player.sentence() >= d.sentences.length - 1" (click)="player.seek(player.sentence() + 1)">›</button>
          <!-- [Fix 2026-11-02]: «Repetir frase» vuelve a leer la frase actual YA (antes solo activaba un bucle que actuaba al terminar) -->
          <button type="button" class="btn btn-outline btn-sm" (click)="player.play(player.sentence())">
            <aula-icon name="repeat" /> {{ tx.repeat }}
          </button>
          <button type="button" class="btn btn-outline btn-sm" [disabled]="player.state() === 'idle'" (click)="player.stop()">{{ tx.stop }}</button>
          <!-- [2026-11-05 · Mismo diseño que «Lectura en voz alta» de Lecciones]: «Velocidad» + <select> N× y botón 🌐 Traducir al español / Ocultar traducción -->
          <label class="flex items-center gap-1 text-xs text-muted-foreground">
            {{ tx.speed }}
            <select class="rounded border border-border bg-transparent px-1 py-0.5 text-xs" [value]="player.rate()" (change)="player.setRate($any(+$any($event.target).value))">
              @for (r of rates; track r) {
                <option [value]="r" [selected]="player.rate() === r">{{ r }}×</option>
              }
            </select>
          </label>
          <!-- [2026-11-05]: el botón solo muestra la traducción; se cierra con la ✕ de su columna -->
          @if (d.language !== 'es') {
            <button type="button" class="btn btn-outline btn-sm" [attr.aria-pressed]="showTranslation()" (click)="showTranslation.set(true)">{{ tx.translateAll }}</button>
          }
          <span class="inline-flex items-center gap-1" role="group" [attr.aria-label]="tx.show">
            <button type="button" class="btn btn-sm" [class]="showIpa() ? 'btn-primary' : 'btn-outline'" [attr.aria-pressed]="showIpa()" (click)="showIpa.set(!showIpa())">{{ tx.ipa }}</button>
          </span>
          <!-- [2026-11-05 · «Marca»]: un solo interruptor — sin marca la pone en la frase actual; con marca la quita -->
          <button type="button" class="btn btn-sm" [class]="d.progress ? 'btn-primary' : 'btn-outline'" [attr.aria-pressed]="!!d.progress" (click)="d.progress ? removeBookmark() : bookmarkHere()">
            <aula-icon name="bookmark" /> {{ tx.bookmarkToggle }}
          </button>
          <details class="relative">
            <summary class="btn btn-ghost btn-sm list-none"><aula-icon name="download" /> {{ tx.download }}</summary>
            <ul class="absolute right-0 z-20 mt-1 w-64 space-y-1 rounded-xl border border-border bg-card p-2 shadow-lg">
              <li><a class="block rounded px-2 py-1 hover:bg-muted" [href]="reading.exportUrl(d.id, 'pdf', both)" download>{{ tx.downloadPdf }}</a></li>
              <li><a class="block rounded px-2 py-1 hover:bg-muted" [href]="reading.exportUrl(d.id, 'docx', both)" download>{{ tx.downloadTxt }}</a></li>
              <li><a class="block rounded px-2 py-1 hover:bg-muted" [href]="reading.exportUrl(d.id, 'docx', none)" download>{{ tx.downloadPlain }}</a></li>
            </ul>
          </details>
          <span class="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto" aria-live="polite">
            {{ i18n.fmt(tx.position, { n: player.sentence() + 1, total: d.sentences.length }) }}
            @if (player.state() === 'playing' && player.sync(); as s) {
              · {{ tx.sync[s] }}
            }
          </span>
        </div>

        <p class="sr-only" aria-live="polite">{{ notice() }}</p>
        @if (notice()) {
          <p class="mb-3 font-semibold text-tone-brand" aria-hidden="true">{{ notice() }}</p>
        }
        <!-- [Traducción en curso]: aviso discreto mientras NestJS completa las frases sin traducir -->
        <p role="status" aria-live="polite" class="mb-3 text-muted-foreground empty:hidden">
          @if (twoColumns() && reading.translating()) {
            <aula-icon name="languages" /> {{ tx.translating }}
          } @else if (twoColumns() && d.pending) {
            <aula-icon name="triangle-alert" /> {{ tx.translationFailed }}
          }
        </p>

        <!-- ── Texto: original (izquierda) · traducción (derecha) | grid de 2 columnas en lg; apiladas en móvil ── -->
        <div [class]="twoColumns() ? 'grid gap-4 lg:grid-cols-2 lg:gap-6' : 'grid gap-4'">
          <section aria-labelledby="reading-original-heading" class="min-w-0">
            <h2 id="reading-original-heading" class="title-overline mb-2 text-muted-foreground">{{ tx.originalColumn }}</h2>
            <!-- data-reading-scroll: columna con scroll propio → scrollIntoBox la mueve sin desplazar la ventana -->
            <div data-reading-scroll [class]="twoColumns() ? scrollBox : ''" (scroll)="closeCard()">
              <article [attr.lang]="d.language" class="space-y-4 text-lg leading-relaxed" [class.font-serif]="d.genre !== 'news'">
                @for (para of paras(); track $index) {
                  <p [class]="d.genre === 'poem' ? 'space-y-0' : ''">
                    @for (s of para; track s.id) {
                      <aula-reading-sentence
                        [class.block]="d.genre === 'poem'"
                        [sentence]="s"
                        [tokens]="player.tokensOf(s.position)"
                        [language]="d.language"
                        [active]="activeSentence() === s.position"
                        [highlight]="highlight() && player.state() === 'playing'"
                        [activeWord]="player.word()"
                        [bookmarkWord]="d.progress && d.progress.sentence === s.position ? d.progress.word : -1"
                        [bookmarkLabel]="tx.bookmark"
                        [showIpa]="showIpa()"
                        [accent]="speech.accent() === 'us' ? 'us' : 'uk'"
                        [marked]="marked()"
                        (pick)="pick(s, $event)"
                      />
                    }
                  </p>
                }
              </article>
            </div>
          </section>
          @if (twoColumns()) {
            <section aria-labelledby="reading-translation-heading" class="min-w-0">
              <div class="mb-2 flex items-center justify-between gap-2">
                <h2 id="reading-translation-heading" class="title-overline text-muted-foreground">{{ tx.translationColumn }}</h2>
                <button type="button" class="btn btn-ghost btn-sm size-8 p-0" [attr.aria-label]="tx.translateOff" [title]="tx.translateOff" (click)="showTranslation.set(false)"><aula-icon name="x" /></button>
              </div>
              <div data-reading-scroll [class]="scrollBox + ' bg-muted/30'">
                <aula-reading-translation-pane
                  [paragraphs]="paras()"
                  [active]="highlight() && player.state() === 'playing' ? activeSentence() : -1"
                  [verse]="d.genre === 'poem' || showIpa()"
                  [pendingLabel]="reading.translating() ? tx.translationPending : tx.translationMissing"
                  (pick)="seekTo($event)"
                />
              </div>
            </section>
          }
        </div>
        <!-- [Ficha de la palabra · 2026-10-30]: 🔊 + IPA + traducción + Aprender, junto a la palabra pulsada (referencia docs/imagen.jpeg)
             \`popover\` (HTML nativo): capa superior del navegador → no la recorta el scroll de la columna ni la desplaza un ancestro con \`transform\` -->
        @if (card(); as c) {
          <div #cardBox popover="manual" data-word-card class="fixed m-0 overflow-visible border-0 bg-transparent p-0" [style.left.px]="c.left" [style.top]="c.top" [style.right]="'auto'" [style.bottom]="c.bottom">
            <aula-word-card [word]="c.word" [language]="d.language" [sentence]="c.sentence" [arrow]="c.arrow" [above]="c.above" (closed)="closeCard(true)" />
          </div>
        }
        @if (finished()) {
          <p role="status" class="mt-6 type-lead font-extrabold text-tone-brand"><aula-icon name="party-popper" /> {{ tx.finished }}</p>
        }
      }
    </aula-card-page>
  `,
})
export default class ReadingReaderPage {
  protected readonly i18n = inject(I18nService);
  protected readonly reading = inject(ReadingFacade);
  private readonly dict = inject(DictionaryFacade);
  protected readonly player = inject(ReadAloudPlayer);
  protected readonly speech = inject(SpeechSynthesisService);
  readonly id = input<string>(); // /lectura/:id (withComponentInputBinding)
  protected readonly both = ['translation', 'ipa'] as const;
  protected readonly none = [] as const;
  protected readonly showIpa = signal(false);
  protected readonly showTranslation = signal(false); // [2026-11-06]: oculta al cargar (antes visible) → el alumno lee primero; «Traducir al español» la abre
  protected readonly rates = [0.75, 1, 1.25, 1.5] as const; // = RATES de PdfReader (Next.js)
  protected readonly highlight = signal(true); // [2026-11-05]: resaltado de frase + palabra siempre activo (se quitó el botón «Resaltado»)
  protected readonly notice = signal('');
  protected readonly finished = signal(false);
  protected readonly card = signal<(WordCardPlace & { word: string; sentence: string; el: HTMLElement }) | null>(null); // Ficha abierta (null = ninguna)
  private readonly cardBox = viewChild<ElementRef<HTMLElement>>('cardBox');
  // [marked]: palabras del banco del alumno en el idioma del texto → se resaltan en el original
  protected readonly marked = computed(() => this.dict.marked()[this.reading.text.data()?.language ?? ''] ?? {});
  protected readonly paras = computed(() => paragraphs(this.reading.text.data()?.sentences ?? []));
  // [twoColumns]: columna de traducción solo si el texto no está en español y el usuario no la ocultó | `computed` (Angular): se recalcula al cambiar sus signals
  protected readonly twoColumns = computed(() => {
    const d = this.reading.text.data();
    return !!d && d.language !== 'es' && this.showTranslation();
  });
  // [activeSentence]: frase resaltada en AMBAS columnas (-1 = ninguna: en reposo sin palabra elegida) | SSOT del resaltado sincronizado
  protected readonly activeSentence = computed(() =>
    this.player.state() !== 'idle' || this.player.word() >= 0 ? this.player.sentence() : -1,
  );
  // [scrollBox]: caja con scroll propio (móvil: 45 % de la pantalla cada una, apiladas · escritorio: 70 %) | `overscroll-contain`: el scroll no se encadena a la página
  protected readonly scrollBox = 'max-h-[45vh] overflow-y-auto overscroll-contain rounded-xl border border-border p-3 lg:max-h-[70vh]';

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
    };
    // [Sincronía de scroll · 2026-10-28]: al cambiar la frase activa, original Y traducción se desplazan a la vez dentro de su columna
    // `requestAnimationFrame` (Web API): tras pintar el resaltado nuevo · sin columnas con scroll propio (solo original) → `scrollIntoView` de la ventana
    effect(() => {
      const i = this.activeSentence();
      if (i < 0) return;
      requestAnimationFrame(() => {
        const original = document.getElementById(`sentence-${i}`);
        if (this.twoColumns()) {
          scrollIntoBox(original);
          scrollIntoBox(document.getElementById(`translation-${i}`));
        } else original?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      });
    });
    // [Banco de vocabulario]: una vez por idioma (la fachada lo cachea)
    effect(() => {
      const lang = this.reading.text.data()?.language;
      if (lang) untracked(() => void this.dict.loadMarked(lang));
    });
    // [Popover]: al aparecer la caja se muestra en la capa superior | `?.()`: navegador sin Popover API → queda como `position: fixed` normal
    effect(() => this.cardBox()?.nativeElement.showPopover?.());
    inject(DestroyRef).onDestroy(() => this.reading.stopPolling()); // `DestroyRef` (Angular): al salir del lector se deja de sondear traducciones
    this.player.onFinish = () => {
      const d = this.reading.text.data();
      this.finished.set(true);
      if (d) void this.reading.saveProgress(d.id, { sentence: Math.max(d.sentences.length - 1, 0), word: 0, finished: true });
    };
  }

  // [pick · Fix 2026-10-30]: clic en una palabra → ficha con sonido, IPA y traducción (antes solo movía el cursor) | si la voz sonaba se pausa: la ficha tiene su propio 🔊
  // El cursor queda en la palabra → «Poner marcador aquí» y «Reproducir» siguen desde esa frase
  protected pick(s: ReadingSentence, { word, text, el }: WordPick): void {
    this.player.pause(); // Sin efecto si no está sonando
    this.player.seek(s.position, word);
    this.card.set({
      word: text,
      sentence: s.text.slice(0, 400), // = @MaxLength de LookupWordDto
      el,
      ...placeWordCard(el.getBoundingClientRect()), // [2026-10-31]: encima de la palabra con flecha, como el diccionario de Cursos
    });
  }

  // [closeCard]: `restoreFocus` → el foco vuelve a la palabra (WCAG 2.4.3) | público para el `host` de la plantilla
  closeCard(restoreFocus = false): void {
    const c = this.card();
    if (!c) return;
    this.card.set(null);
    if (restoreFocus) c.el.focus();
  }

  onDocClick(e: MouseEvent): void {
    if (!(e.target as Element).closest?.('[data-word-card],[data-reading-word]')) this.closeCard();
  }

  // [seekTo]: clic en una frase de la traducción → el lector salta a la frase original equivalente (misma `position`)
  protected seekTo(position: number): void {
    this.player.seek(position, this.player.state() === 'playing' ? -1 : 0);
  }

  // [bookmarkHere · 2026-11-03]: guarda el marcador en la frase/palabra actual (la elegida con clic o la que suena)
  protected async bookmarkHere(): Promise<void> {
    const d = this.reading.text.data();
    if (!d) return;
    const sentence = this.player.sentence();
    await this.reading.saveProgress(d.id, { sentence, word: Math.max(this.player.word(), 0), finished: false });
    this.notice.set(this.i18n.fmt(this.i18n.t().reading.bookmarkSaved, { n: sentence + 1 }));
  }

  // [removeBookmark · 2026-11-05]: borra el marcador guardado (DELETE progress) y limpia el cursor
  protected async removeBookmark(): Promise<void> {
    const d = this.reading.text.data();
    if (!d) return;
    await this.reading.resetProgress(d.id);
    this.player.stop();
    this.notice.set(this.i18n.t().reading.bookmarkRemoved);
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
