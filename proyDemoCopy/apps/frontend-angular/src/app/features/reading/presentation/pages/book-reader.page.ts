import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { ReturnLinkComponent } from '@core/layout/return-to'; // [2026-11-16]: mismo «Volver a …» (enlace) que /lectura/:id
import { SpeechSynthesisService } from '@core/audio/speech-synthesis.service';
import { I18nService } from '@core/i18n/i18n.service';
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { WordLookupComponent } from '@shared/ui/organisms/word-lookup/word-lookup.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { BooksFacade } from '../../application/books.facade';
import { ReadAloudPlayer, type ReadingRate } from '../../application/read-aloud.player';
import { activeEntry, authorsLabel, sourceHost, chapterProgress, lineIndexOf, pageOfParagraph, tocEntries, type BookLine, type SentenceIpa, type TocEntry } from '../../domain/models/book';
import { tokenize, type Token } from '../../domain/models/reading';
import { prefersReducedMotion, scrollIntoBox } from '../scroll-into-box';
// [BookReaderPage · Presentación · Lectura → Libros · RF-146/RF-147 · 2026-11-14]: /lectura/libros/:id — original y traducción al español en columnas
// (debajo en pantallas estrechas), audio con la voz del navegador y marcador que sigue la lectura, IPA de la frase y diccionario al pulsar una palabra
// [Reutiliza]: ReadAloudPlayer (máquina idle/playing/paused + eventos `boundary` · RF-29/RF-124), WordLookupComponent (IPA, traducción, sonido y
// «Aprender» · RF-136/RF-137), SpeechSynthesisService (voces) y la Translator API → traductor de la plataforma (BooksFacade · RF-30)
// [Resaltado · 2026-11-17]: marcador POR PALABRA (<mark>) mientras suena, con cualquier fuente de sincronía y también con IPA; en pausa, fondo suave en la frase · no solo color (WCAG 1.4.1)
// [A11y · WCAG 2.1 AA]: barra role="toolbar" con <button> nativos y nombres accesibles, aria-pressed en interruptores, estado y posición en aria-live,
// <progress> con etiqueta, `lang` en cada columna, seguimiento automático desactivable y sin animación con prefers-reduced-motion

const RATES: readonly ReadingRate[] = [0.75, 1, 1.25];
const TRANSLATE_AHEAD = 2; // [2026-11-17]: párrafos que se traducen por delante con el traductor del servidor
// [2026-11-16]: títulos de índice en los 7 idiomas y encabezados típicos de Gutenberg («Letter 1», «CHAPTER IV», «Capítulo 2»…)
const TOC_TITLE = /^(table of )?contents?$|^[ií]ndice$|^contenido$|^table des mati[eè]res$|^sommaire$|^inhalt(sverzeichnis)?$|^sommario$|^содержание$|^оглавление$/iu;
// [HEADING_ALL · 2026-11-16]: lo mismo, global → cuenta cuántos títulos trae un párrafo de índice («Letter 1 Letter 2 … Chapter 24» en una línea)
// `(?<!\p{L})` / `(?!\p{L})` (lookbehind/lookahead Unicode): límites de palabra que también valen para el cirílico (`\b` solo entiende ASCII)
const HEADING_ALL = /(?<!\p{L})(letter|chapter|book|part|volume|act|scene|cap[ií]tulo|carta|parte|libro|chapitre|lettre|kapitel|brief|teil|capitolo|lettera|глава|письмо|часть)\s+([0-9]+|[ivxlcdm]+)(?![\p{L}\d])\.?/giu;
const HEADING = /^(letter|chapter|book|part|volume|act|scene|cap[ií]tulo|carta|parte|libro|chapitre|lettre|kapitel|brief|teil|capitolo|lettera|глава|письмо|часть)\s+([0-9]+|[ivxlcdm]+|[a-z]+)\.?$/iu;

interface ParagraphView {
  index: number;
  lines: { line: BookLine; at: number }[]; // `at` = posición en la lista del reproductor
}

@Component({
  selector: 'aula-book-reader-page',
  imports: [ReturnLinkComponent, CardPageTemplate, SpinnerComponent, IconComponent, WordLookupComponent],
  providers: [ReadAloudPlayer], // Un reproductor por pantalla
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().books;
    @let idx = books.index();
    <aula-card-page [heading]="idx?.book?.title ?? tx.title" [headingLang]="idx?.language ?? ''" [subtitle]="idx ? authors(idx.book) : ''">
      <aula-return-link pageBack fallback="/lectura/libros" [label]="tx.back" />
      @if (books.error()) {
        <p role="alert" class="mb-3 text-tone-danger">{{ books.error() }}</p>
      }
      @if (!idx) {
        @if (!books.error()) {
          <!-- [2026-11-17]: primera apertura → el servidor descarga el libro en segundo plano y aquí se avisa (antes: spinner hasta el error de 30 s) -->
          <aula-spinner [label]="books.preparing() ? tx.preparing : tx.opening" />
          @if (books.preparing()) {
            <p role="status" class="mt-2 text-muted-foreground">{{ tx.preparing }}</p>
          }
        }
      } @else {
        <p class="mb-2 type-meta text-muted-foreground">
          @if (idx.book.genre) {
            <span class="badge bg-tone-brand-soft text-tone-brand">{{ genreLabel(idx.book.genre) }}</span>
          }
          <span class="badge bg-muted">{{ tx.unclassified }}</span>
          {{ idx.book.attribution }} <a class="underline" [href]="idx.book.sourceUrl" target="_blank" rel="noopener noreferrer">{{ host(idx.book.sourceUrl) }}</a>
        </p>
        @if (resumed()) {
          <p role="status" class="mb-2 text-tone-brand">{{ tx.resumed }}</p>
        }
        @if (!hasVoice()) {
          <p role="status" class="mb-2 rounded-lg bg-tone-warning-soft p-2 text-tone-warning"><aula-icon name="triangle-alert" /> {{ tx.noVoice }}</p>
        }

        <!-- [2026-11-16 · Mismo diseño que /lectura/:id]: «🔊 Audio lectura» en su renglón · ‹ Reproducir › · Repetir · Detener · Velocidad · Traducir al español · IPA
             Todos son <button>/<select> nativos → teclado y lector de pantalla | aria-pressed en los interruptores -->
        <div role="toolbar" [attr.aria-label]="tx.toolbar" class="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/95 p-2 shadow-sm backdrop-blur">
          <h2 class="title-card w-full">{{ tx.readAloud }}</h2>
          <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="tx.prev" [title]="tx.prev" (click)="step(-1)" [disabled]="player.sentence() <= 0">‹</button>
          <button type="button" class="btn btn-primary btn-sm min-w-28" (click)="player.toggle()" [attr.aria-pressed]="player.state() === 'playing'">
            <aula-icon [name]="player.state() === 'playing' ? 'pause' : 'play'" /> {{ player.state() === 'playing' ? tx.pause : tx.play }}
          </button>
          <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="tx.next" [title]="tx.next" (click)="step(1)" [disabled]="player.sentence() >= books.lines().length - 1">›</button>
          <button type="button" class="btn btn-outline btn-sm" (click)="player.play(player.sentence())"><aula-icon name="repeat" /> {{ tx.repeat }}</button>
          <button type="button" class="btn btn-outline btn-sm" [disabled]="player.state() === 'idle'" (click)="player.stop()">{{ tx.stop }}</button>
          <label class="flex items-center gap-1 text-xs text-muted-foreground">
            {{ tx.speed }}
            <select class="rounded border border-border bg-transparent px-1 py-0.5 text-xs" (change)="setRate($any($event.target).value)">
              @for (r of rates; track r) {
                <option [value]="r" [selected]="r === player.rate()">{{ r }}×</option>
              }
            </select>
          </label>
          <label class="flex items-center gap-1 text-xs text-muted-foreground">
            {{ tx.voice }}
            <select class="max-w-40 rounded border border-border bg-transparent px-1 py-0.5 text-xs" (change)="speech.preferredVoice.set($any($event.target).value || null)">
              <option value="">{{ tx.autoVoice }}</option>
              @for (v of voices(); track v.name) {
                <option [value]="v.name" [selected]="v.name === speech.preferredVoice()">{{ v.name }}</option>
              }
            </select>
          </label>
          @if (idx.language !== 'es') {
            <button type="button" class="btn btn-outline btn-sm" [attr.aria-pressed]="showTranslation()" (click)="showTranslation.set(!showTranslation())">
              {{ showTranslation() ? tx.hideTranslation : tx.translateAll }}
            </button>
          }
          <button type="button" class="btn btn-sm" [class]="showIpa() ? 'btn-primary' : 'btn-outline'" [attr.aria-pressed]="showIpa()" (click)="showIpa.set(!showIpa())">{{ tx.ipa }}</button>
        </div>

        <div class="mb-3 flex flex-wrap items-center gap-3 type-meta">
          <label class="flex items-center gap-2">
            {{ tx.progress }}
            <progress class="w-40" max="100" [value]="progress()"></progress>
            <span>{{ progress() }} %</span>
          </label>
          <span aria-live="polite">
            {{ tx.states[player.state()] }} · {{ i18n.fmt(tx.position, { n: player.sentence() + 1, total: books.lines().length }) }}
            @if (player.state() === 'playing' && player.sync()) {
              · {{ player.sync() === 'boundary' ? tx.wordSync : tx.sentenceSync }}
            }
          </span>
        </div>

        <!-- [2026-11-16]: título del capítulo centrado y en negrita («Letter 1», «Chapter 3»…) -->
        <h2 class="mb-4 text-center text-xl font-bold" [attr.lang]="idx.language">{{ idx.chapters[books.chapter()]?.title }}</h2>
        @if (isToc()) {
          <!-- [2026-11-16 · Índice]: «CONTENTS» venía en una sola línea → lista ordenada; cada entrada abre su capítulo -->
          <nav [attr.aria-label]="tx.contents">
            <ol class="space-y-1">
              @for (c of idx.chapters; track c.index) {
                @if (c.index !== books.chapter()) {
                  <li>
                    <button type="button" class="w-full rounded-lg px-3 py-1.5 text-left font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" [attr.lang]="idx.language" (click)="changeChapter(c.index)">{{ c.title }}</button>
                  </li>
                }
              }
            </ol>
          </nav>
        } @else {
        <!-- [2026-11-17 · Igual que /lectura/:id]: IZQUIERDA el original, DERECHA la traducción, cada columna con su propio scroll que sigue a la voz A LA VEZ
             (scrollIntoBox) · frase activa con fondo + anillo y la palabra con <mark> · la traducción se carga sola, párrafo a párrafo, desde el que suena -->
        <p role="status" aria-live="polite" class="mb-3 text-muted-foreground empty:hidden">
          @if (twoColumns() && books.translating() !== null) {
            <aula-icon name="languages" /> {{ tx.translating }}
          }
        </p>
        <div [class]="twoColumns() ? 'grid gap-4 lg:grid-cols-2 lg:gap-6' : 'grid gap-4'">
          <section class="min-w-0" [attr.aria-label]="tx.original">
            <div data-reading-scroll [class]="twoColumns() ? scrollBox : ''">
              <div class="space-y-4">
                @for (p of paragraphs(); track p.index) {
                  @let toc = tocOf(p);
                  @if (toc) {
                    <!-- [2026-11-16 · Índice dentro del capítulo]: párrafo con ≥3 títulos → lista de ítems; cada uno abre su capítulo -->
                    <nav [attr.aria-label]="tx.contents">
                      <ol class="space-y-1">
                        @for (t of toc; track $index) {
                          <li>
                            <button type="button" class="w-full rounded-lg px-3 py-1.5 text-left font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" [attr.lang]="idx.language" (click)="openHeading(t)">{{ t }}</button>
                          </li>
                        }
                      </ol>
                    </nav>
                  } @else {
                    <!-- [2026-11-16]: párrafo que es un título («Letter 2», «CHAPTER IV») → centrado y en negrita -->
                    <p [class]="isHeading(p) ? 'text-center font-bold leading-relaxed' : 'text-lg leading-relaxed'" [attr.lang]="idx.language">
                      @for (l of p.lines; track l.at) {
                        @let current = l.at === activeLine();
                        @let playing = l.at === player.sentence() && player.state() === 'playing';
                        <!-- Con IPA → cada frase en su bloque y, dentro, renglón (cláusula) + su IPA debajo -->
                        <span
                          [id]="'line-' + l.at"
                          [attr.aria-current]="current ? 'true' : null"
                          [class]="'rounded px-0.5 transition-colors ' + (showIpa() ? 'mb-2 block py-1 ' : '') + (current ? 'bg-tone-brand-soft ring-1 ring-tone-brand-line' : '')"
                        >
                          @if (showIpa()) {
                            @let parts = ipa()[l.at];
                            @if (parts) {
                              @for (part of parts; track $index) {
                                @if (playing) {
                                  <!-- [2026-11-17]: marcador POR PALABRA también con IPA (índice de palabra = palabras de los renglones anteriores + la del renglón) -->
                                  <span class="block">
                                    @for (t of partTokens(parts, $index); track $index) {
                                      @if (t.word >= 0 && t.word === player.word()) {
                                        <mark class="rounded-sm bg-tone-warning-soft px-0.5 text-foreground">{{ t.text }}</mark>
                                      } @else {
                                        {{ t.text }}
                                      }
                                    }
                                  </span>
                                } @else {
                                  <span class="block"><span aulaWordText [text]="part.text" [language]="idx.language"></span></span>
                                }
                                <span class="block font-mono text-sm font-normal text-muted-foreground" [attr.lang]="idx.language + '-fonipa'">/{{ part.ipa }}/</span>
                              }
                            } @else {
                              <span class="block"><span aulaWordText [text]="l.line.text" [language]="idx.language"></span></span>
                              <span class="block font-mono text-sm text-muted-foreground" aria-hidden="true">…</span>
                            }
                          } @else if (playing) {
                            @for (t of player.tokensOf(l.at); track $index) {
                              @if (t.word >= 0 && t.word === player.word()) {
                                <mark class="rounded-sm bg-tone-warning-soft px-0.5 text-foreground">{{ t.text }}</mark>
                              } @else {
                                {{ t.text }}
                              }
                            }
                          } @else {
                            <span aulaWordText [text]="l.line.text" [language]="idx.language"></span>
                          }
                        </span>
                        {{ ' ' }}
                      }
                    </p>
                  }
                }
              </div>
            </div>
          </section>
          @if (twoColumns()) {
            <section class="min-w-0" [attr.aria-label]="tx.translation">
              <div class="mb-2 flex items-center justify-between gap-2">
                <h2 class="title-overline text-muted-foreground">{{ tx.translation }}</h2>
                <button type="button" class="btn btn-ghost btn-sm size-8 p-0" [attr.aria-label]="tx.hideTranslation" [title]="tx.hideTranslation" (click)="showTranslation.set(false)"><aula-icon name="x" /></button>
              </div>
              <div data-reading-scroll lang="es" [class]="scrollBox + ' space-y-4 bg-muted/30'">
                @for (p of paragraphs(); track p.index) {
                  @if (!tocOf(p)) {
                    @let tr = books.translations()[p.index];
                    <!-- Párrafo traducido: resaltado A LA VEZ que su frase original · pulsarlo salta a esa frase -->
                    <button
                      type="button"
                      [id]="'tr-' + p.index"
                      [attr.aria-current]="activeParagraph() === p.index ? 'true' : null"
                      [class]="
                        'block w-full rounded px-1 text-left leading-relaxed transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring ' +
                        (isHeading(p) ? 'text-center font-bold ' : '') +
                        (activeParagraph() === p.index ? 'bg-tone-brand-soft ring-1 ring-tone-brand-line text-foreground' : 'text-muted-foreground')
                      "
                      (click)="seekParagraph(p)"
                    >
                      @if (tr !== undefined) {
                        {{ tr ?? tx.sameLanguage }}
                      } @else {
                        <!-- [2026-11-17]: pendiente = se traduce al llegar la lectura o al pulsarlo (clic → salta y traduce) -->
                        <span class="italic opacity-70">{{ books.translating() === p.index ? tx.translating : tx.translationPending }}</span>
                      }
                    </button>
                  }
                }
              </div>
            </section>
          }
        </div>
        @if (hasMore()) {
          <button type="button" class="btn btn-outline mt-4" (click)="more()">{{ tx.loadMore }}</button>
        }
        }
        <!-- [2026-11-17 · Paginación por capítulos]: ‹ anterior · n de total · siguiente › (capítulos y cartas del índice) -->
        @let ents = entries();
        @if (ents.length > 1) {
          <nav class="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4" [attr.aria-label]="tx.pagination">
            <button type="button" class="btn btn-outline btn-sm" [disabled]="active() <= 0" (click)="goTo(ents[active() - 1])">
              <span aria-hidden="true">‹</span> {{ active() > 0 ? ents[active() - 1].title : tx.prevChapter }}
            </button>
            <span class="type-meta font-semibold" aria-current="page">{{ i18n.fmt(tx.chapterN, { n: active() + 1, total: ents.length }) }}</span>
            <button type="button" class="btn btn-outline btn-sm" [disabled]="active() >= ents.length - 1" (click)="goTo(ents[active() + 1])">
              {{ active() < ents.length - 1 ? ents[active() + 1].title : tx.nextChapter }} <span aria-hidden="true">›</span>
            </button>
          </nav>
        }
      }
    </aula-card-page>
  `,
})
export default class BookReaderPage {
  readonly id = input.required<string>(); // `withComponentInputBinding`: parámetro de la ruta
  protected readonly i18n = inject(I18nService);
  protected readonly books = inject(BooksFacade);
  protected readonly player = inject(ReadAloudPlayer);
  protected readonly speech = inject(SpeechSynthesisService);
  protected readonly rates = RATES;
  protected readonly authors = authorsLabel;
  protected readonly host = sourceHost;
  // [scrollBox]: = /lectura/:id → caja con scroll propio (móvil 45 % de la pantalla, escritorio 70 %)
  protected readonly scrollBox = 'max-h-[45vh] overflow-y-auto overscroll-contain rounded-xl border border-border p-3 lg:max-h-[70vh]';
  private trRun = 0; // Token del bucle de traducción en curso
  protected readonly showTranslation = signal(true);
  protected readonly showIpa = signal(false);
  protected readonly resumed = signal(false);
  protected readonly ipa = signal<Record<number, SentenceIpa['parts']>>({}); // [2026-11-16]: renglones con su IPA por frase
  private ipaRun = 0; // Token del bucle de IPA en curso
  private readonly voicesTick = signal(0); // Las voces llegan tarde (evento `voiceschanged`)

  protected readonly voices = computed(() => {
    this.voicesTick();
    const lang = this.books.index()?.language;
    return lang ? this.speech.voicesFor(lang) : [];
  });
  protected readonly hasVoice = computed(() => {
    this.voicesTick();
    const lang = this.books.index()?.language;
    return !lang || this.speech.hasVoice(lang);
  });
  protected readonly paragraphs = computed<ParagraphView[]>(() => {
    const out: ParagraphView[] = [];
    this.books.lines().forEach((line, at) => {
      const last = out.at(-1);
      if (last?.index === line.paragraph) last.lines.push({ line, at });
      else out.push({ index: line.paragraph, lines: [{ line, at }] });
    });
    return out;
  });
  protected readonly progress = computed(() => {
    const line = this.books.lines()[this.player.sentence()];
    const total = this.books.index()?.chapters[this.books.chapter()]?.paragraphs ?? 0;
    return line ? chapterProgress(line.paragraph, total) : 0;
  });
  // [isToc · 2026-11-16]: capítulo «índice» = título tipo CONTENTS/Índice… o texto corto que nombra ≥3 capítulos | [Paradigma]: Funcional (computed puro)
  protected readonly isToc = computed(() => {
    const idx = this.books.index();
    const title = idx?.chapters[this.books.chapter()]?.title ?? '';
    if (TOC_TITLE.test(title.trim())) return true;
    const text = this.books.lines().map((l) => l.text).join(' ');
    return text.length < 4000 && (idx?.chapters ?? []).filter((c) => c.title && c.title !== title && text.includes(c.title)).length >= 3;
  });

  // [isHeading]: párrafo de una sola línea corta sin punto final que coincide con un capítulo o con «Letter/Chapter/Capítulo N»
  protected isHeading(p: ParagraphView): boolean {
    if (p.lines.length !== 1) return false;
    const t = p.lines[0].line.text.trim();
    return t.length <= 60 && !/[.!?…]$/.test(t) && (HEADING.test(t) || !!this.books.index()?.chapters.some((c) => c.title === t));
  }

  // [tocOf · 2026-11-16]: párrafo que es SOLO una lista de títulos (≥3 «Letter N/Chapter N…», sin más texto que «Contents») → sus entradas; si no, null
  protected tocOf(p: ParagraphView): string[] | null {
    const text = p.lines.map((l) => l.line.text).join(' ');
    const found = text.match(HEADING_ALL) ?? [];
    if (found.length < 3) return null;
    const rest = text.replace(HEADING_ALL, '').replace(/contents?|[ií]ndice|contenido|table des mati[eè]res|sommaire|inhalt|sommario|содержание|оглавление/giu, '');
    return rest.replace(/[^\p{L}]/gu, '').length <= 20 ? found.map((t) => t.replace(/\.$/, '').trim()) : null;
  }

  // [openHeading]: entrada del índice → capítulo con el mismo título (sin mayúsculas ni punto final)
  protected async openHeading(title: string): Promise<void> {
    const norm = (t: string) => t.toLowerCase().replace(/[.\s]+$/, '').replace(/\s+/g, ' ');
    const c = this.books.index()?.chapters.find((x) => norm(x.title) === norm(title));
    if (c) return void this.changeChapter(c.index);
    // [2026-11-16]: «Letter 1…4» de Frankenstein NO son capítulos (van dentro de «Inicio») → se salta a ese título en el capítulo actual
    // Puede estar en una página aún no cargada → se cargan páginas (máx. 10) hasta encontrarlo
    let at = this.books.lines().findIndex((l) => norm(l.text) === norm(title));
    for (let i = 0; at < 0 && i < 10 && this.hasMore(); i++) {
      await this.more();
      at = this.books.lines().findIndex((l) => norm(l.text) === norm(title));
    }
    if (at < 0) return;
    this.player.seek(at);
    document.getElementById(`line-${at}`)?.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    void this.books.saveProgress(this.books.lines()[at]);
  }

  // [2026-11-17]: entradas del índice (paginación) y entrada activa (la última que empieza antes de la frase actual)
  protected readonly entries = computed<TocEntry[]>(() => tocEntries(this.books.index()?.chapters ?? []));
  protected readonly active = computed(() => {
    const lines = this.books.lines();
    const paragraph = lines[this.player.sentence()]?.paragraph ?? lines[0]?.paragraph ?? 0;
    return activeEntry(this.entries(), this.books.chapter(), paragraph);
  });

  // [partTokens]: palabras de un renglón con su índice de palabra EN LA FRASE (para el marcador)
  protected partTokens(parts: readonly { text: string }[], k: number): Token[] {
    const lang = this.books.index()?.language ?? 'en';
    const offset = parts.slice(0, k).reduce((n, p) => n + tokenize(p.text, lang).filter((t) => t.word >= 0).length, 0);
    return tokenize(parts[k]!.text, lang).map((t) => (t.word >= 0 ? { ...t, word: t.word + offset } : t));
  }

  // [goTo]: abre el capítulo en la página del título elegido y se coloca en su primera frase
  protected async goTo(e: TocEntry | undefined): Promise<void> {
    if (!e) return;
    this.player.stop();
    this.ipa.set({});
    await this.books.loadChapter(e.chapter, pageOfParagraph(e.paragraph));
    const at = Math.max(0, this.books.lines().findIndex((l) => l.paragraph >= e.paragraph));
    this.reload(at);
    window.scrollTo?.({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    void this.books.saveProgress(this.books.lines()[at]);
  }

  protected readonly twoColumns = computed(() => this.showTranslation() && this.books.index()?.language !== 'es');
  // [activeLine]: frase resaltada (-1 = ninguna: en reposo sin frase elegida) · = activeSentence de /lectura/:id
  protected readonly activeLine = computed(() => (this.player.state() !== 'idle' || this.player.word() >= 0 ? this.player.sentence() : -1));
  protected readonly activeParagraph = computed(() => this.books.lines()[this.activeLine()]?.paragraph ?? -1);

  // [seekParagraph]: clic en un párrafo de la traducción → el lector salta a su primera frase
  protected seekParagraph(p: ParagraphView): void {
    if (!(p.index in this.books.translations())) void this.translate(p); // [2026-11-17]: pulsar un párrafo sin traducir lo traduce
    const at = p.lines[0]?.at;
    if (at !== undefined) this.player.seek(at, this.player.state() === 'playing' ? -1 : 0);
  }

  protected readonly hasMore = computed(() => {
    const last = this.books.pages().at(-1);
    return !!last && last.page < last.pages;
  });

  // [genreLabel]: clave del género → etiqueta del idioma de la interfaz
  protected genreLabel(g: string): string {
    return (this.i18n.t().books.genres as Record<string, string>)[g] ?? g;
  }

  constructor() {
    const onVoices = () => this.voicesTick.update((n) => n + 1);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.addEventListener('voiceschanged', onVoices);
    // [Fix 2026-11-17 · «Volver a los libros» se quedaba bloqueado]: al salir se cortan los bucles de traducción e IPA (seguían pidiendo
    // cada párrafo al LLM) y el sondeo del libro · el listener de voces también se quita | [Principio]: sin trabajo huérfano
    inject(DestroyRef).onDestroy(() => {
      this.trRun++;
      this.ipaRun++;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.removeEventListener('voiceschanged', onVoices);
      this.books.dispose();
    });

    effect(() => {
      const id = Number(this.id());
      untracked(() => void this.open(id));
    });

    this.player.onSentence = (i) => this.onSentence(i);
    this.player.onFinish = () => void this.continueReading();

    // [Sincronía de scroll · 2026-11-17 · = /lectura/:id]: al cambiar la frase activa, original Y traducción se desplazan a la vez dentro de su columna
    // `requestAnimationFrame`: tras pintar el resaltado · sin columna de traducción → `scrollIntoView` de la ventana
    effect(() => {
      const i = this.activeLine();
      if (i < 0) return;
      const two = this.twoColumns();
      const paragraph = this.books.lines()[i]?.paragraph;
      requestAnimationFrame(() => {
        const line = document.getElementById(`line-${i}`);
        if (two) {
          scrollIntoBox(line);
          scrollIntoBox(document.getElementById(`tr-${paragraph}`));
        } else line?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      });
    });

    // [Traducción automática · 2026-11-17]: con la columna abierta se traducen solos los párrafos cargados, uno tras otro, desde el que suena
    // (como /lectura/:id, que se rellena sola) · `trRun`: al cerrar la columna o cambiar de página se corta el bucle anterior
    // [Fix 2026-11-17 · lentitud]: sin Translator API del navegador cada párrafo iba al LLM del servidor (CPU al 100 % → app «bloqueada»)
    // → ahora solo el párrafo activo y los TRANSLATE_AHEAD siguientes; al avanzar la lectura se traduce la siguiente ventana | [Patrón]: Sliding Window
    effect(() => {
      const paras = this.paragraphs();
      if (!this.twoColumns()) return;
      const activeIdx = this.activeParagraph(); // Tracked: al cambiar de párrafo se traduce la nueva ventana
      const run = ++this.trRun;
      const from = activeIdx >= 0 ? activeIdx : (paras[0]?.index ?? 0);
      const sorted = [...paras].sort((a, b) => (a.index < from ? a.index + 1e6 : a.index) - (b.index < from ? b.index + 1e6 : b.index));
      void (async () => {
        const local = await this.books.hasLocalTranslator();
        // `filter` (ES5): ventana corta si traduce el servidor; todo lo cargado si traduce el navegador
        const order = local ? sorted : sorted.filter((p) => p.index >= from && p.index <= from + TRANSLATE_AHEAD);
        for (const p of order) {
          if (run !== this.trRun) return;
          if (p.index in untracked(this.books.translations) || this.tocOf(p)) continue;
          await this.translate(p);
        }
      })();
    });

    // [IPA · 2026-11-16]: como en /lectura/:id → bajo CADA frase cargada (interruptor «IPA») · una frase tras otra, empezando por la actual, y una sola vez
    // `ipaRun`: token → al apagar o cambiar de capítulo se corta el bucle anterior | ponytail: secuencial (no satura el servicio de IA); por lotes si el backend lo admite
    effect(() => {
      const lines = this.books.lines();
      if (!this.showIpa()) return;
      const run = ++this.ipaRun;
      const from = untracked(this.player.sentence);
      const rank = (i: number) => (i < from ? i + lines.length : i); // Primero desde la frase actual, luego las anteriores
      const order = [...lines.keys()].sort((a, b) => rank(a) - rank(b));
      void (async () => {
        for (const i of order) {
          if (run !== this.ipaRun || !untracked(this.showIpa)) return; // `untracked`: el bucle no re-dispara el effect
          if (i in untracked(this.ipa)) continue;
          const r = await this.books.ipa(lines[i]).catch(() => null);
          // Sin `parts` (respuesta vieja) → un solo renglón con la frase entera
          if (r && run === this.ipaRun) this.ipa.update((m) => ({ ...m, [i]: r.parts.length ? r.parts : [{ text: lines[i].text, ipa: r.ipa }] }));
        }
      })();
    });
  }

  private async open(id: number): Promise<void> {
    this.player.stop();
    const pos = await this.books.open(id);
    const lines = this.books.lines();
    const start = pos ? lineIndexOf(lines, pos) : 0;
    this.resumed.set(!!pos);
    this.player.load(lines.map((l) => l.text), this.books.index()?.language ?? 'en', start);
  }

  protected changeChapter(chapter: number): Promise<void> {
    return this.goTo({ title: '', chapter, paragraph: 0 });
  }

  protected setRate(value: string): void {
    const rate = RATES.find((r) => String(r) === value);
    if (rate) this.player.setRate(rate);
  }

  protected step(delta: number): void {
    const i = this.player.sentence() + delta;
    this.player.seek(i);
    void this.books.saveProgress(this.books.lines()[i]);
  }

  protected translate(p: ParagraphView): Promise<void> {
    return this.books.translate(p.index, p.lines.map((l) => l.line.text).join(' '));
  }

  protected async more(): Promise<void> {
    const current = this.player.sentence();
    if (await this.books.loadMore()) this.reload(current);
  }

  private onSentence(i: number): void {
    const line = this.books.lines()[i];
    void this.books.saveProgress(line);
  }

  // [continueReading]: al terminar lo cargado, trae la siguiente página del capítulo y sigue sonando
  private async continueReading(): Promise<void> {
    const next = this.books.lines().length;
    if (!(await this.books.loadMore())) return;
    this.reload(next);
    this.player.play(next);
  }

  private reload(start: number): void {
    this.ipa.set({});
    this.player.load(this.books.lines().map((l) => l.text), this.books.index()?.language ?? 'en', start);
  }
}
