import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BooksRepository } from '../domain/books.repository.port';
import { linesOf, pageOfParagraph, type BookIndex, type BookLine, type BookPosition, type BookSearchResult, type ChapterPage, type SentenceIpa } from '../domain/models/book';
// [BooksFacade · Aplicación · Lectura → Libros · RF-145/146/147 · 2026-11-14]: catálogo, lectura por páginas, traducción e IPA bajo demanda y progreso
// [Traducción · RF-30]: 1) Translator API del navegador (en el dispositivo, sin red) si admite el par → 2) traductor de la plataforma (NestJS → LLM local,
// con el párrafo anterior como contexto y caché por libro/párrafo/idioma en el servidor) | [Patrón]: Facade + Feature Detection + Fallback + Cache
// [Nada masivo]: una página (20 párrafos) cada vez; traducción e IPA solo del párrafo/frase que se pide | [Paradigma]: Reactivo (signals) + async/await

interface BrowserTranslator {
  translate(text: string): Promise<string>;
}
interface TranslatorFactory {
  availability?(o: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
  create(o: { sourceLanguage: string; targetLanguage: string }): Promise<BrowserTranslator>;
}

// [browserTranslator]: Translator API si existe y el par está disponible; si no, null → servidor | exportada para pruebas
export async function browserTranslator(source: string, target: string, g: unknown = globalThis): Promise<BrowserTranslator | null> {
  const factory = (g as { Translator?: TranslatorFactory }).Translator;
  if (!factory) return null;
  try {
    const status = (await factory.availability?.({ sourceLanguage: source, targetLanguage: target })) ?? 'available';
    if (status === 'unavailable') return null;
    return await factory.create({ sourceLanguage: source, targetLanguage: target });
  } catch {
    return null;
  }
}

const TARGET = 'es';
const PREPARE_POLL_MS = 5_000; // [2026-11-17]: el servidor ya espera hasta 15 s por petición → ~20 s entre respuestas
const PREPARE_POLLS = 30; // ~10 min como mucho (espejo lento de Gutenberg)
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

@Injectable()
export class BooksFacade {
  private readonly repo = inject(BooksRepository);
  readonly results = signal<BookSearchResult | null>(null);
  readonly searching = signal(false);
  readonly error = signal('');
  readonly index = signal<BookIndex | null>(null);
  readonly chapter = signal(0);
  readonly pages = signal<ChapterPage[]>([]);
  readonly lines = signal<BookLine[]>([]);
  readonly translations = signal<Record<number, string | null>>({}); // párrafo → traducción (null = el libro ya está en español)
  readonly translating = signal<number | null>(null);
  readonly preparing = signal(false); // [2026-11-17]: el servidor descarga el libro en segundo plano
  private openRun = 0; // Token: salir del lector (dispose) o abrir otro libro corta el sondeo anterior
  private lastSearch = ''; // [2026-11-17]: misma búsqueda con resultados → no se repite al volver a la lista
  private translator: Promise<BrowserTranslator | null> | null = null;
  private lastSaved = '';

  async search(q: { search?: string; language?: string; genre?: string; page: number }): Promise<void> {
    const key = JSON.stringify([q.search ?? '', q.language ?? '', q.genre ?? '', q.page]);
    if (key === this.lastSearch && this.results() && !this.error()) return; // «Volver a los libros» instantáneo
    this.lastSearch = key;
    this.searching.set(true);
    this.error.set('');
    try {
      this.results.set(await firstValueFrom(this.repo.search(q)));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
      this.results.set(null);
      this.lastSearch = '';
    } finally {
      this.searching.set(false);
    }
  }

  // [open]: índice del libro + progreso guardado → carga SOLO la página donde se quedó | devuelve la posición a retomar
  // [2026-11-17 · Preparación]: si el servidor responde { preparing } se vuelve a preguntar cada PREPARE_POLL_MS mientras la pantalla siga abierta
  async open(id: number): Promise<BookPosition | null> {
    this.reset();
    const run = ++this.openRun;
    this.error.set('');
    try {
      const progress = firstValueFrom(this.repo.progress(id)).catch(() => null);
      let res = await firstValueFrom(this.repo.open(id));
      for (let i = 0; 'preparing' in res && i < PREPARE_POLLS; i++) {
        if (run !== this.openRun) return null;
        this.preparing.set(true);
        await sleep(PREPARE_POLL_MS);
        if (run !== this.openRun) return null;
        res = await firstValueFrom(this.repo.open(id));
      }
      if (run !== this.openRun) return null;
      if ('preparing' in res) throw new Error('El libro tarda demasiado en descargarse. Inténtalo de nuevo más tarde.');
      const index = res;
      const pos = await progress;
      this.index.set(index);
      const chapter = pos && pos.chapter < index.chapters.length ? pos.chapter : 0;
      await this.loadChapter(chapter, pos && chapter === pos.chapter ? pageOfParagraph(pos.paragraph) : 1);
      return pos && chapter === pos.chapter ? pos : null;
    } catch (e) {
      if (run === this.openRun) this.error.set(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      if (run === this.openRun) this.preparing.set(false);
    }
  }

  // [dispose · 2026-11-17]: al salir del lector → corta el sondeo y suelta el libro (la lista no espera a nada)
  dispose(): void {
    this.openRun++;
    this.preparing.set(false);
    this.translating.set(null);
    this.reset();
  }

  async loadChapter(chapter: number, page = 1): Promise<void> {
    const id = this.index()?.book.id;
    if (id === undefined) return;
    const p = await firstValueFrom(this.repo.page(id, chapter, page));
    this.chapter.set(chapter);
    this.translations.set({});
    this.setPages([p]);
  }

  // [loadMore]: siguiente página del capítulo (carga progresiva) · false = no hay más
  async loadMore(): Promise<boolean> {
    const id = this.index()?.book.id;
    const last = this.pages().at(-1);
    if (id === undefined || !last || last.page >= last.pages) return false;
    const p = await firstValueFrom(this.repo.page(id, this.chapter(), last.page + 1));
    this.setPages([...this.pages(), p]);
    return true;
  }

  async translate(paragraph: number, text: string): Promise<void> {
    const index = this.index();
    if (!index || paragraph in this.translations() || this.translating() === paragraph) return;
    this.translating.set(paragraph);
    try {
      let out: string | null = null;
      if (index.language !== TARGET) {
        this.translator ??= browserTranslator(index.language, TARGET);
        const local = await this.translator;
        out = local ? await local.translate(text).catch(() => null) : null;
        out ??= (await firstValueFrom(this.repo.translate(index.book.id, this.chapter(), paragraph))).translation;
      }
      this.translations.update((t) => ({ ...t, [paragraph]: out }));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.translating.set(null);
    }
  }

  // [hasLocalTranslator · 2026-11-17]: ¿el navegador traduce en el dispositivo (Translator API)? → el lector decide cuánto traducir solo
  // Sin ella cada párrafo va al LLM del servidor (Ollama en CPU) → solo se traduce una ventana corta alrededor de lo que suena
  async hasLocalTranslator(): Promise<boolean> {
    const index = this.index();
    if (!index || index.language === TARGET) return false;
    this.translator ??= browserTranslator(index.language, TARGET);
    return (await this.translator) !== null;
  }

  ipa(line: BookLine): Promise<SentenceIpa> {
    const id = this.index()?.book.id ?? 0;
    return firstValueFrom(this.repo.ipa(id, this.chapter(), line.paragraph, line.sentence));
  }

  // [saveProgress]: solo si cambió la posición (la voz avanza frase a frase) · un fallo de red no interrumpe la lectura
  async saveProgress(line: BookLine | undefined): Promise<void> {
    const id = this.index()?.book.id;
    if (id === undefined || !line) return;
    const pos = { chapter: this.chapter(), paragraph: line.paragraph, sentence: line.sentence };
    const key = `${id}:${pos.chapter}:${pos.paragraph}:${pos.sentence}`;
    if (key === this.lastSaved) return;
    this.lastSaved = key;
    await firstValueFrom(this.repo.saveProgress(id, pos)).catch(() => (this.lastSaved = ''));
  }

  private setPages(pages: ChapterPage[]): void {
    this.pages.set(pages);
    this.lines.set(linesOf(pages));
  }

  private reset(): void {
    this.index.set(null);
    this.pages.set([]);
    this.lines.set([]);
    this.translations.set({});
    this.translator = null;
    this.lastSaved = '';
  }
}
