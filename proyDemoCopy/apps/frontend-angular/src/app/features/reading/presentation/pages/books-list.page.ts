import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '@core/i18n/i18n.service';
import { ReturnLinkComponent } from '@core/layout/return-to'; // [2026-11-16]: mismo «Volver a Lectura» que el lector de lecturas (enlace, no botón)
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { FilterPanelComponent } from '@shared/ui/molecules/filter-panel/filter-panel.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { ReadingViewsComponent } from '../components/reading-views.component'; // [2026-11-16]: pills Lecturas · Dictado · Libros clásicos
import { BooksFacade } from '../../application/books.facade';
import { authorsLabel, BOOK_GENRES, coverFallback, sourceHost, type Book } from '../../domain/models/book';
// [BooksListPage · Presentación · Lectura → Libros · RF-145 · 2026-11-14]: /lectura/libros — buscar libros de dominio público por título o autor en los 7 idiomas
// [2026-11-16 · Diseño uniforme]: misma estructura que /lectura → página sin caja (`bare`), panel de filtros común (Buscar · Filtrar · Limpiar + idiomas con «Todos» DEBAJO),
// tarjetas FUERA del panel y paginación Anterior · Página N · Siguiente (Gutendex da 32 libros por página y solo indica si hay siguiente)
// Cada tarjeta lleva la atribución a Project Gutenberg | [Patrón]: Container + Facade | [A11y]: <nav> de paginación con nombre, página actual con aria-current, estados role="status"/"alert"
// [Sin descargas]: buscar solo trae fichas; el texto se descarga al pulsar «Leer» (un libro)

@Component({
  selector: 'aula-books-list-page',
  imports: [RouterLink, ReturnLinkComponent, ReadingViewsComponent, CardPageTemplate, SpinnerComponent, IconComponent, FilterPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().books;
    <aula-card-page [heading]="tx.title" [subtitle]="tx.subtitle" [bare]="true">
      <aula-return-link pageBack fallback="/lectura" [label]="tx.backToReading" />
      <!-- Panel común: «Buscar» (título o autor) + Filtrar/Limpiar y los idiomas debajo, con «Todos» · sin nivel (los libros no tienen MCER) -->
      <!-- [2026-11-17]: + Género (novela, cuento, poesía…) → «topic» de Gutendex -->
      <aula-filter-panel [(search)]="query" [(language)]="language" [showLevel]="false" [searchPlaceholder]="tx.search" (apply)="run(1)" (cleared)="genre.set(''); run(1)">
        <label class="filter-field">
          {{ tx.genre }}
          <select class="control" [value]="genre()" (change)="genre.set($any($event.target).value)">
            <option value="">{{ tx.anyGenre }}</option>
            @for (g of genres; track g) {
              <option [value]="g" [selected]="g === genre()">{{ tx.genres[g] }}</option>
            }
          </select>
        </label>
      </aula-filter-panel>
      <!-- [2026-11-16]: pills Lecturas · Dictado · Libros clásicos DEBAJO del panel de filtros, una al lado de la otra -->
      <aula-reading-views class="mb-4 block" />

      @if (books.searching()) {
        <aula-spinner [label]="i18n.t().common.loading" />
      } @else if (books.error()) {
        <p role="alert" class="text-tone-danger">{{ books.error() }}</p>
      } @else if (books.results(); as r) {
        @if (!r.books.length) {
          <p role="status" class="rounded-xl border border-dashed border-border p-4 text-center text-muted-foreground">{{ tx.empty }}</p>
        }
        <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          @for (b of r.books; track b.id) {
            <li>
              <article class="surface flex h-full flex-col gap-2 p-4">
                <!-- [2026-11-17]: portada (Gutenberg) o imagen de la obra/retrato del autor (Wikidata) · decorativa: el título va debajo -->
                <!-- [Fix 2026-11-17]: portada que no carga (gutenberg.org en mantenimiento → 503) → espejo oficial y, si tampoco, recuadro con la inicial -->
                @if (b.imageUrl && !broken().has(b.id)) {
                  <img [src]="b.imageUrl" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" class="h-44 w-full rounded-lg bg-muted object-cover object-top" (error)="onImageError(b, $event)" />
                } @else {
                  <div aria-hidden="true" class="grid h-44 w-full place-items-center rounded-lg bg-muted text-5xl font-bold text-muted-foreground">{{ b.title.charAt(0) }}</div>
                }
                <h2 class="title-section" [attr.lang]="b.languages[0]">
                  <a class="text-foreground hover:underline" [routerLink]="['/lectura/libros', b.id]">{{ b.title }}</a>
                </h2>
                <p class="type-meta text-muted-foreground">{{ authors(b) }}</p>
                <p class="flex flex-wrap gap-1.5 type-meta">
                  @for (l of b.languages; track l) {
                    <span class="badge bg-tone-brand-soft text-tone-brand">{{ i18n.languageName(l) }}</span>
                  }
                  @if (b.genre) {
                    <!-- [2026-11-17]: género (categoría de Wikisource o filtro elegido) -->
                    <span class="badge bg-tone-brand-soft text-tone-brand">{{ genreLabel(b.genre) }}</span>
                  }
                  <span class="badge bg-muted">{{ tx.unclassified }}</span>
                </p>
                <p class="type-meta text-muted-foreground">
                  {{ b.attribution }} <a class="underline" [href]="b.sourceUrl" target="_blank" rel="noopener noreferrer">{{ host(b.sourceUrl) }}</a>
                </p>
                <a class="btn btn-outline btn-sm mt-auto self-start" [routerLink]="['/lectura/libros', b.id]"><aula-icon name="book-open" /> {{ tx.open }}</a>
              </article>
            </li>
          }
        </ul>
        @if (r.page > 1 || r.hasNext) {
          <nav class="flex items-center justify-center gap-2" [attr.aria-label]="tx.pagination">
            <button type="button" class="btn btn-outline btn-sm" [disabled]="r.page <= 1" (click)="run(r.page - 1)"><span aria-hidden="true">‹</span> {{ tx.prevPage }}</button>
            <span class="type-meta font-semibold" aria-current="page">{{ i18n.fmt(tx.pageN, { n: r.page }) }}</span>
            <button type="button" class="btn btn-outline btn-sm" [disabled]="!r.hasNext" (click)="run(r.page + 1)">{{ tx.nextPage }} <span aria-hidden="true">›</span></button>
          </nav>
        }
      }
    </aula-card-page>
  `,
})
export default class BooksListPage {
  protected readonly i18n = inject(I18nService);
  protected readonly books = inject(BooksFacade);
  protected readonly language = signal<string>(''); // '' = «Todos» los idiomas
  protected readonly query = signal('');
  protected readonly genre = signal(''); // '' = todos los géneros
  protected readonly genres = BOOK_GENRES;
  protected readonly authors = authorsLabel;
  protected readonly host = sourceHost;
  protected readonly broken = signal<ReadonlySet<number>>(new Set()); // Libros sin imagen que cargue

  protected genreLabel(g: string): string {
    return (this.i18n.t().books.genres as Record<string, string>)[g] ?? g;
  }

  // [onImageError]: 1.er fallo → espejo de Gutenberg · si no hay espejo o también falla → recuadro con la inicial
  protected onImageError(b: Book, ev: Event): void {
    const img = ev.target as HTMLImageElement;
    const next = coverFallback(img.src);
    if (next) img.src = next;
    else this.broken.update((s) => new Set(s).add(b.id));
  }

  constructor() {
    // `effect`: al cambiar de idioma se busca de nuevo (el texto escrito se usa tal cual, sin reaccionar a cada tecla)
    effect(() => {
      this.language();
      this.genre();
      untracked(() => void this.run(1));
    });
  }

  protected run(page: number): Promise<void> {
    window.scrollTo?.({ top: 0 }); // Página nueva → arriba (las tarjetas quedan a la vista)
    return this.books.search({ search: this.query().trim() || undefined, language: this.language() || undefined, genre: this.genre() || undefined, page });
  }
}
