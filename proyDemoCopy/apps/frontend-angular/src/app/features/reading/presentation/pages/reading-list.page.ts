import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CEFR_LEVELS, LANGUAGES, READING_GENRES } from '@aula/shared-schemas';
import { I18nService } from '@core/i18n/i18n.service';
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { ActivitySectionsComponent } from '@shared/ui/molecules/pill-nav/pill-nav.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { ReadingFacade } from '../../application/reading.facade';
import { readingMinutes } from '../../domain/models/reading';
// [ReadingListPage · Presentación · Lectura · 2026-10-25]: /lectura — lecturas publicadas filtrables por idioma, nivel y género, con las pills de secciones de Actividades
// [Patrón]: Container (smart) + Facade | [Principio]: SRP + DRY (mismas pills, tarjeta y filtros que Diálogos) | [Paradigma]: Declarativo + Reactivo (effect recarga al cambiar un filtro)
// [A11y]: <label> visible en cada filtro · lista semántica (<ul>/<article>/<h2>) · estados con role="alert"/«status» · [Responsive]: rejilla 1 → 2 → 3 columnas

@Component({
  selector: 'aula-reading-list-page',
  imports: [RouterLink, CardPageTemplate, SpinnerComponent, IconComponent, ActivitySectionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().reading;
    <aula-card-page [heading]="i18n.t().common.activitySections.title" [subtitle]="tx.title + ' · ' + tx.subtitle" [bare]="true">
      <aula-activity-sections pageNav />
      <form class="mb-6 grid gap-3 rounded-xl bg-muted p-3 sm:grid-cols-3" (submit)="$event.preventDefault()" [attr.aria-label]="tx.title">
        <label class="text-xs font-semibold text-muted-foreground">
          {{ tx.language }}
          <select class="control mt-1 w-full bg-card" [value]="language()" (change)="language.set($any($event.target).value)">
            @for (l of languages; track l) {
              <option [value]="l">{{ i18n.languageName(l) }}</option>
            }
          </select>
        </label>
        <label class="text-xs font-semibold text-muted-foreground">
          {{ tx.level }}
          <select class="control mt-1 w-full bg-card" [value]="level()" (change)="level.set($any($event.target).value)">
            <option value="">{{ tx.anyLevel }}</option>
            @for (l of levels; track l) {
              <option [value]="l">{{ l }}</option>
            }
          </select>
        </label>
        <label class="text-xs font-semibold text-muted-foreground">
          {{ tx.genre }}
          <select class="control mt-1 w-full bg-card" [value]="genre()" (change)="genre.set($any($event.target).value)">
            <option value="">{{ tx.anyGenre }}</option>
            @for (g of genres; track g) {
              <option [value]="g">{{ tx.genres[g] }}</option>
            }
          </select>
        </label>
      </form>

      @switch (reading.list.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <p role="alert" class="text-sm text-tone-danger">{{ reading.list.error() }}</p>
        }
        @case ('empty') {
          <p role="status" class="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">{{ tx.empty }}</p>
        }
        @case ('success') {
          <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            @for (r of reading.list.data(); track r.id) {
              <li>
                <article class="surface flex h-full flex-col gap-2 p-4">
                  <h2 class="font-bold leading-tight">
                    <a class="text-foreground hover:underline" [routerLink]="['/lectura', r.id]" [attr.lang]="r.language">{{ r.title }}</a>
                  </h2>
                  <p class="flex flex-wrap items-center gap-1.5 text-xs">
                    <span class="badge bg-tone-brand-soft text-tone-brand">{{ i18n.languageName(r.language) }}</span>
                    <span class="badge bg-muted">{{ r.level }}</span>
                    <span class="badge bg-muted">{{ tx.genres[r.genre] }}</span>
                    <span class="text-muted-foreground">{{ i18n.fmt(tx.minutes, { n: minutes(r.wordCount) }) }} · {{ i18n.fmt(tx.sentences, { n: r.sentenceCount }) }}</span>
                  </p>
                  @if (r.summary) {
                    <p lang="es" class="line-clamp-3 text-sm text-muted-foreground">{{ r.summary }}</p>
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
  protected readonly languages = LANGUAGES;
  protected readonly levels = CEFR_LEVELS;
  protected readonly genres = READING_GENRES;
  protected readonly language = signal<string>('en');
  protected readonly level = signal('');
  protected readonly genre = signal('');
  protected readonly minutes = readingMinutes;

  constructor() {
    // `effect` (Angular Signals): cualquier filtro que cambie recarga la lista
    effect(() => void this.reading.loadList({ language: this.language(), level: this.level() || undefined, genre: this.genre() || undefined }));
  }
}
