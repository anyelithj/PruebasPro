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
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { I18nService } from '@core/i18n/i18n.service';
import { TextImportService } from '@core/media/text-import.service'; // [DRY]: mismo extractor que canciones y cursos (PDF, Word, Excel, OCR, audio/video)
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { PronunciationButtonComponent } from '@shared/ui/molecules/pronunciation-button/pronunciation-button.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { VocabularyFacade } from '../../application/vocabulary.facade';
import { VocabularyRepository } from '../../domain/vocabulary.repository.port';
import { LookupInputSchema, VOCAB_LANGUAGES, type LookupInput, type VocabLanguage } from '../../domain/models/vocabulary';
import { TranslationCardComponent } from '../components/translation-card.component';
// [LanguageLookupPage · Presentación · Sprint 8.3 → rediseño 2026-10-23]: /traductor al estilo Google Translate — barra de idiomas con «intercambiar», dos paneles (original | traducción), subir CUALQUIER archivo (PDF, Word, Excel, imagen, audio/video) y, para palabras o frases cortas, la ficha con IPA UK/US y «guardar en mi vocabulario»
// [Patrón]: Container (smart) + Facade (VocabularyFacade) + Chunking (textos largos en trozos de ≤ CHUNK caracteres) | [Principio]: SRP + DIP (puerto VocabularyRepository) + DRY (TextImportService) | [Paradigma]: Declarativo + Reactivo (signals) + async/await
// [Deep link]: /traductor?q=umbrella&lang=en sigue funcionando (lo usan Next.js y los juegos) · [A11y]: etiquetas visibles, región viva para la traducción y el progreso, atajo Ctrl+Enter, botones con nombre accesible
// [Responsive]: paneles apilados en móvil, lado a lado desde lg

const MAX_CHARS = 5000; // Tope del texto original (≈ 10 llamadas al LLM local)
const CHUNK = 480; // `TranslateTextDto.text` admite 500 → margen
const AUTO_MS = 900; // [2026-10-23 · 4.º pase]: pausa al teclear antes de traducir solo
const SHORT = 80; // Hasta aquí se muestra la ficha con IPA (palabras y frases cortas)

// [chunks]: parte el texto por líneas y frases sin cortar palabras; las líneas vacías se conservan | función pura (Paradigma Funcional)
export function chunks(text: string, size = CHUNK): string[] {
  const out: string[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) {
      out.push(''); // Párrafo vacío: se mantiene el formato
      continue;
    }
    let buf = '';
    // `split` con lookbehind (ES2018): corta después de . ! ? 。 conservando el signo
    for (const sentence of line.split(/(?<=[.!?。])\s+/)) {
      if ((buf + ' ' + sentence).trim().length > size && buf) {
        out.push(buf.trim());
        buf = '';
      }
      buf += ` ${sentence}`;
      while (buf.trim().length > size) {
        const cut = buf.lastIndexOf(' ', size) > 0 ? buf.lastIndexOf(' ', size) : size; // Frase gigante → corte en el último espacio
        out.push(buf.slice(0, cut).trim());
        buf = buf.slice(cut);
      }
    }
    if (buf.trim()) out.push(buf.trim());
  }
  return out;
}

@Component({
  selector: 'aula-language-lookup-page',
  imports: [
    RouterLink,
    CardPageTemplate,
    ButtonComponent,
    IconComponent,
    SpinnerComponent,
    PronunciationButtonComponent,
    TranslationCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().vocabulary;
    <aula-card-page [heading]="tx.lookupTitle" [subtitle]="tx.lookupSubtitle">
      <a pageActions aulaButton variant="outline" size="sm" routerLink="/vocabulario">{{ tx.openBank }}</a>

      <!-- [Barra de idiomas]: origen ⇄ destino (como Google Translate) | <select> nativos con etiqueta visible -->
      <div class="flex flex-wrap items-end gap-2">
        <label class="min-w-40 flex-1 text-xs font-semibold text-muted-foreground">
          {{ tx.from }}
          <select class="control mt-1 w-full" [value]="source()" (change)="source.set($any($event.target).value)">
            @for (code of languages; track code) {
              <option [value]="code" [selected]="code === source()">{{ i18n.languageName(code) }}</option>
            }
          </select>
        </label>
        <button type="button" class="btn btn-ghost btn-sm mb-0.5" [attr.aria-label]="tx.swap" [title]="tx.swap" (click)="swap()">
          <aula-icon name="arrow-left-right" [size]="18" />
        </button>
        <label class="min-w-40 flex-1 text-xs font-semibold text-muted-foreground">
          {{ tx.to }}
          <select class="control mt-1 w-full" [value]="target()" (change)="target.set($any($event.target).value)">
            @for (code of languages; track code) {
              <option [value]="code" [selected]="code === target()">{{ i18n.languageName(code) }}</option>
            }
          </select>
        </label>
      </div>

      <!-- [Dos paneles]: original | traducción -->
      <div class="mt-4 grid gap-4 lg:grid-cols-2">
        <!-- [Arrastrar y soltar · 2026-10-23 · 4.º pase]: el panel original acepta un archivo soltado encima (como Google Translate › Documentos) | HTML5 Drag and Drop API -->
        <section
          class="surface relative flex flex-col p-3 transition-colors"
          [class.ring-2]="dragging()"
          [class.ring-primary]="dragging()"
          [attr.aria-label]="tx.sourceLabel"
          (dragover)="onDragOver($event)"
          (dragleave)="dragging.set(false)"
          (drop)="onDrop($event)"
        >
          @if (dragging()) {
            <div class="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-xl bg-tone-brand-soft/90 text-sm font-bold text-tone-brand" aria-hidden="true">
              <span class="inline-flex items-center gap-2"><aula-icon name="upload" [size]="20" /> {{ tx.dropHere }}</span>
            </div>
          }
          @if (fileName()) {
            <p class="mb-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[11px] font-semibold text-muted-foreground">
              <aula-icon name="file-text" [size]="14" /> {{ i18n.fmt(tx.fileLoaded, { name: fileName() }) }}
            </p>
          }
          <label for="tr-source" class="sr-only">{{ tx.sourceLabel }}</label>
          <textarea
            id="tr-source"
            class="min-h-56 w-full flex-1 resize-y rounded-lg bg-transparent p-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            [attr.lang]="source()"
            [attr.maxlength]="max"
            [placeholder]="tx.sourcePlaceholder"
            [value]="text()"
            (input)="onType($any($event.target).value)"
            (keydown.control.enter)="run()"
            (keydown.meta.enter)="run()"
          ></textarea>
          <div class="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2">
            <label class="btn btn-outline btn-sm cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring" [title]="tx.fileHint">
              <aula-icon name="upload" /> {{ tx.uploadFile }}
              <input type="file" class="sr-only" [accept]="accept" [disabled]="busy()" (change)="readFile($any($event.target))" />
            </label>
            @if (text().trim()) {
              <aula-pronunciation-button [text]="text().slice(0, 300)" [language]="source()" [label]="tx.listen" />
              <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="tx.clear" [title]="tx.clear" (click)="clear()">
                <aula-icon name="x" />
              </button>
            }
            <span class="ml-auto text-[11px] text-muted-foreground">{{ i18n.fmt(tx.chars, { n: text().length, max }) }}</span>
          </div>
          <p class="mt-1 text-[11px] text-muted-foreground">{{ tx.fileHint }} · {{ tx.shortcut }}</p>
        </section>

        <section class="surface flex flex-col bg-gradient-soft p-3" [attr.aria-label]="tx.targetLabel">
          <div class="min-h-56 flex-1 whitespace-pre-wrap p-2 text-base" aria-live="polite" [attr.lang]="target()">
            @if (output()) {
              {{ output() }}
            } @else if (!busy()) {
              <span class="text-muted-foreground">{{ tx.targetEmpty }}</span>
            }
          </div>
          <div class="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2">
            @if (output()) {
              <aula-pronunciation-button [text]="output().slice(0, 300)" [language]="target()" [label]="tx.listen" />
              <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="tx.copy" [title]="tx.copy" (click)="copy()">
                <aula-icon name="copy" />
              </button>
              <!-- [Descargar · 2026-10-23 · 4.º pase]: la traducción como .txt (Blob + enlace temporal, sin servidor) -->
              <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="tx.download" [title]="tx.download" (click)="download()">
                <aula-icon name="download" />
              </button>
            }
            @if (status()) {
              <span role="status" class="text-xs font-semibold text-tone-brand">{{ status() }}</span>
            }
          </div>
        </section>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-3">
        <!-- [Traducción automática · 2026-10-23 · 4.º pase]: como Google Translate, traduce al dejar de escribir (debounce) — se puede desactivar para no cargar la IA local -->
        <label class="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-muted-foreground">
          <input type="checkbox" class="size-4 accent-[var(--primary)]" [checked]="auto()" (change)="auto.set($any($event.target).checked)" />
          {{ tx.autoTranslate }}
        </label>
        <button aulaButton type="button" [loading]="busy()" [disabled]="!text().trim() || source() === target()" (click)="run()">
          {{ tx.translate }}
        </button>
        @if (busy()) {
          <aula-spinner [label]="status() || tx.translating" />
        }
        @if (error()) {
          <p role="alert" class="text-sm text-tone-danger">{{ error() }}</p>
        }
      </div>

      <!-- [Ficha corta]: palabra o frase breve en un idioma extranjero → IPA UK/US + guardar en el banco -->
      @if (facade.result.status() === 'success' && facade.result.data(); as lookup) {
        <section class="mt-6 rounded-2xl border border-border bg-gradient-soft p-4 sm:p-6" [attr.aria-label]="tx.lookupDetailTitle">
          <h2 class="mb-3 text-sm font-bold">{{ tx.lookupDetailTitle }}</h2>
          <aula-translation-card [t]="tx" [lookup]="lookup" [saving]="facade.saving()" (save)="facade.saveToBank($event)" />
          @if (facade.saved(); as term) {
            <p role="status" class="mt-3 text-sm font-semibold text-tone-brand">
              <aula-icon name="check" /> {{ i18n.fmt(tx.saved, { term }) }}
              <a routerLink="/vocabulario" class="underline">{{ tx.openBank }}</a>
            </p>
          }
          @if (facade.saveError(); as err) {
            <p role="alert" class="mt-3 text-sm text-tone-danger">{{ err }}</p>
          }
        </section>
      }

      <!-- [Historial]: consultas de esta visita; volver a una no hace otra petición -->
      @if (facade.history().length > 1) {
        <section class="mt-6" [attr.aria-label]="tx.history">
          <h2 class="mb-2 text-sm font-bold">{{ tx.history }}</h2>
          <ul class="flex flex-wrap gap-2">
            @for (h of facade.history(); track h.id) {
              <li>
                <button type="button" class="chip" [attr.aria-pressed]="facade.result.data()?.id === h.id" (click)="show(h.text, h.language)">
                  {{ h.text }}
                </button>
              </li>
            }
          </ul>
        </section>
      }
    </aula-card-page>
  `,
})
export default class LanguageLookupPage {
  protected readonly i18n = inject(I18nService);
  protected readonly facade = inject(VocabularyFacade);
  private readonly repo = inject(VocabularyRepository);
  private readonly importer = inject(TextImportService);
  readonly q = input<string>(); // ?q= (withComponentInputBinding)
  readonly lang = input<string>(); // ?lang=

  protected readonly languages = VOCAB_LANGUAGES;
  protected readonly max = MAX_CHARS;
  // `.ttf/.mp3…` (accept): el extractor del BFF decide; aquí solo se filtra el diálogo
  // [2026-10-23 · 4.º pase]: sin filtro → CUALQUIER archivo; el extractor del BFF decide (PDF, Word, PowerPoint, Excel, OpenDocument, RTF, EPUB, texto, imagen, audio/video) y explica si no puede
  protected readonly accept = '';
  protected readonly source = signal<VocabLanguage>('en');
  protected readonly target = signal<VocabLanguage>('es');
  protected readonly text = signal('');
  protected readonly output = signal('');
  protected readonly busy = signal(false);
  protected readonly status = signal('');
  protected readonly error = signal('');
  protected readonly dragging = signal(false); // [2026-10-23 · 4.º pase]: hay un archivo arrastrándose sobre el panel
  protected readonly fileName = signal(''); // Archivo del que sale el texto original
  protected readonly auto = signal(true); // Traducir mientras se escribe
  private typingTimer?: ReturnType<typeof setTimeout>; // `ReturnType<typeof setTimeout>` (TS): vale en navegador y en Node (tests)
  // `computed` (signals): la ficha con IPA solo tiene sentido para textos cortos en un idioma extranjero
  private readonly isShort = computed(() => this.text().trim().length > 0 && this.text().trim().length <= SHORT && this.source() !== 'es');

  constructor() {
    // [Deep link]: ?q= válido → rellena y traduce una vez
    effect(() => {
      const parsed = LookupInputSchema.safeParse({ text: this.q() ?? '', language: this.lang() ?? 'en' });
      if (!parsed.success) return;
      untracked(() => this.show(parsed.data.text, parsed.data.language));
    });
  }

  // [swap]: intercambia idiomas y textos (la traducción pasa a ser el original)
  protected swap(): void {
    const [s, t] = [this.source(), this.target()];
    this.source.set(t);
    this.target.set(s);
    if (this.output()) {
      this.text.set(this.output());
      this.output.set('');
    }
  }

  // [onType · 2026-10-23 · 4.º pase]: texto escrito → traducción automática a los AUTO_MS sin teclear | [Patrón]: Debounce
  // Solo textos cortos (≤ CHUNK): uno largo se traduce por trozos con el botón para no saturar la IA local a cada tecla
  protected onType(value: string): void {
    this.text.set(value);
    this.fileName.set('');
    clearTimeout(this.typingTimer);
    if (this.auto() && value.trim() && value.trim().length <= CHUNK) this.typingTimer = setTimeout(() => void this.run(), AUTO_MS);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault(); // Sin esto el navegador abriría el archivo en la pestaña
    this.dragging.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) void this.translateFile(file);
  }

  // [download]: Blob (Web API) + <a download> temporal → archivo «traduccion-<idioma>.txt»
  protected download(): void {
    const url = URL.createObjectURL(new Blob([this.output()], { type: 'text/plain;charset=utf-8' }));
    const base = this.fileName().replace(/\.[^.]+$/, '') || 'traduccion';
    Object.assign(document.createElement('a'), { href: url, download: `${base}-${this.target()}.txt` }).click();
    URL.revokeObjectURL(url);
  }

  protected clear(): void {
    this.fileName.set('');
    this.text.set('');
    this.output.set('');
    this.error.set('');
    this.status.set('');
  }

  protected show(text: string, language: string): void {
    this.source.set(language as VocabLanguage);
    if (language === this.target()) this.target.set(language === 'es' ? 'en' : 'es');
    this.text.set(text);
    void this.run();
  }

  // [run]: traduce por trozos (progreso visible) y, si el texto es corto, pide además la ficha con IPA | [Patrón]: Chunking + Progressive Rendering
  protected async run(): Promise<void> {
    const text = this.text().trim().slice(0, MAX_CHARS);
    const tx = this.i18n.t().vocabulary;
    if (!text || this.busy() || this.source() === this.target()) return;
    this.busy.set(true);
    this.error.set('');
    this.output.set('');
    try {
      if (this.isShort()) void this.facade.lookup({ text, language: this.source() as LookupInput['language'] });
      const parts = chunks(text);
      const done: string[] = [];
      const real = parts.filter(Boolean).length;
      let n = 0;
      for (const part of parts) {
        if (!part) {
          done.push('');
          continue;
        }
        this.status.set(real > 1 ? this.i18n.fmt(tx.progress, { n: ++n, total: real }) : tx.translating);
        done.push(await firstValueFrom(this.repo.translate(part, this.source(), this.target())));
        this.output.set(done.join('\n').replace(/\n{3,}/g, '\n\n')); // Se pinta a medida que llega
      }
      this.status.set('');
    } catch {
      this.error.set(tx.translateError);
      this.status.set('');
    } finally {
      this.busy.set(false);
    }
  }

  // [readFile]: cualquier archivo → texto (BFF /api/media/extract-text) → panel original → traducción automática
  protected async readFile(el: HTMLInputElement): Promise<void> {
    const file = el.files?.[0];
    el.value = ''; // Permite volver a elegir el mismo archivo
    if (file) await this.translateFile(file);
  }

  // [translateFile]: compartido por «Subir archivo» y arrastrar/soltar | [Principio]: DRY
  private async translateFile(file: File): Promise<void> {
    const tx = this.i18n.t().vocabulary;
    this.busy.set(true);
    this.error.set('');
    this.status.set(this.i18n.fmt(tx.readingFile, { name: file.name }));
    try {
      const r = await this.importer.fromFile(file, this.source());
      this.text.set(r.text.slice(0, MAX_CHARS));
      this.fileName.set(file.name);
    } catch (err) {
      const body = (err as { error?: { message?: string } }).error;
      this.error.set(body?.message ?? (err instanceof Error ? err.message : String(err)));
      return;
    } finally {
      this.busy.set(false);
      this.status.set('');
    }
    void this.run();
  }

  // [copy]: Clipboard API (requiere contexto seguro; en localhost lo es)
  protected async copy(): Promise<void> {
    await navigator.clipboard.writeText(this.output());
    this.status.set(this.i18n.t().vocabulary.copied);
  }
}
