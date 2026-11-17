import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CEFR_LEVELS, READING_GENRES } from '@aula/shared-schemas';
import { I18nService } from '@core/i18n/i18n.service';
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { ActivitySectionsComponent } from '@shared/ui/molecules/pill-nav/pill-nav.component';
import { FilterPanelComponent } from '@shared/ui/molecules/filter-panel/filter-panel.component'; // [2026-11-11]: panel común
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { ReadingViewsComponent } from '../components/reading-views.component'; // [2026-11-16]: pills Lecturas · Dictado · Libros clásicos
import { ReadingFacade } from '../../application/reading.facade';
import { readingMinutes } from '../../domain/models/reading';
// [2026-11-17]: sin tarjetas de libros abajo (están en /lectura/libros, pill «Libros clásicos»)
// [ReadingListPage · Presentación · Lectura · 2026-10-25]: /lectura — lecturas publicadas filtrables por idioma, nivel y género, con las pills de secciones de Actividades
// [Patrón]: Container (smart) + Facade | [Principio]: SRP + DRY (mismas pills, tarjeta y filtros que Diálogos) | [Paradigma]: Declarativo + Reactivo (effect recarga al cambiar un filtro)
// [A11y]: <label> visible en cada filtro · lista semántica (<ul>/<article>/<h2>) · estados con role="alert"/«status» · [Responsive]: rejilla 1 → 2 → 3 columnas

@Component({
  selector: 'aula-reading-list-page',
  imports: [RouterLink, ReadingViewsComponent, CardPageTemplate, SpinnerComponent, IconComponent, ActivitySectionsComponent, FilterPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().reading;
    <aula-card-page [heading]="i18n.t().common.activitySections.title" [subtitle]="tx.title + ' · ' + tx.subtitle" [bare]="true">
      <aula-activity-sections pageNav />
      <!-- [2026-11-11]: MISMO panel de filtros que Gestión → Actividades (Buscar · Nivel · Género · Filtrar · Limpiar + idiomas) · sin «Todos» en idioma: la lectura siempre es de un idioma -->
      <aula-filter-panel [(search)]="search" [(level)]="level" [(language)]="language" [languageAll]="false" (cleared)="genre.set('')">
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

      @switch (reading.list.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <p role="alert" class="text-tone-danger">{{ reading.list.error() }}</p>
        }
        @case ('empty') {
          <p role="status" class="rounded-xl border border-dashed border-border p-4 text-center text-muted-foreground">{{ tx.empty }}</p>
        }
        @case ('success') {
          @if (!shown().length) {
            <p role="status" class="rounded-xl border border-dashed border-border p-4 text-center text-muted-foreground">{{ tx.empty }}</p>
          }
          <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            @for (r of shown(); track r.id) {
              <li>
                <article class="surface flex h-full flex-col gap-2 p-4">
                  <h2 class="title-section">
                    <a class="text-foreground hover:underline" [routerLink]="['/lectura', r.id]" [attr.lang]="r.language">{{ r.title }}</a>
                  </h2>
                  <p class="flex flex-wrap items-center gap-1.5 type-meta">
                    <span class="badge bg-tone-brand-soft text-tone-brand">{{ i18n.languageName(r.language) }}</span>
                    <span class="badge bg-muted">{{ r.level }}</span>
                    <span class="badge bg-muted">{{ tx.genres[r.genre] }}</span>
                    <span class="text-muted-foreground">{{ i18n.fmt(tx.minutes, { n: minutes(r.wordCount) }) }} · {{ i18n.fmt(tx.sentences, { n: r.sentenceCount }) }}</span>
                  </p>
                  @if (r.summary) {
                    <p lang="es" class="line-clamp-3 text-muted-foreground">{{ r.summary }}</p>
                  }
                  <a class="btn btn-outline btn-sm mt-auto self-start" [routerLink]="['/lectura', r.id]"><aula-icon name="book-open" /> {{ tx.read }}</a>
                </article>
              </li>
            }
          </ul>
        }
      }

    </aula-card-page>
  `,
})
export default class ReadingListPage {
  protected readonly i18n = inject(I18nService);
  protected readonly reading = inject(ReadingFacade);
  protected readonly levels = CEFR_LEVELS;
  protected readonly genres = READING_GENRES;
  protected readonly language = signal<string>('en');
  protected readonly level = signal('');
  protected readonly genre = signal('');
  protected readonly search = signal(''); // [2026-11-11]: por título o resumen (en el navegador)
  protected readonly shown = computed(() => {
    const q = this.search().trim().toLowerCase();
    return (this.reading.list.data() ?? []).filter((r) => !q || `${r.title} ${r.summary ?? ''}`.toLowerCase().includes(q));
  });
  protected readonly minutes = readingMinutes;

  constructor() {
    // `effect` (Angular Signals): cualquier filtro que cambie recarga la lista
    effect(() => void this.reading.loadList({ language: this.language(), level: this.level() || undefined, genre: this.genre() || undefined }));
  }
}
