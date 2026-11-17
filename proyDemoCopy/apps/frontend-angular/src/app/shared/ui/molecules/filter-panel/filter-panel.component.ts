import { ChangeDetectionStrategy, Component, inject, input, model, output } from '@angular/core';
import { CEFR_LEVELS } from '@aula/shared-schemas';
import { I18nService } from '@core/i18n/i18n.service';
import { LanguageChipsComponent } from '@shared/ui/molecules/language-chips/language-chips.component';
// [FilterPanelComponent · Molécula · 2026-11-11]: panel de filtros de las secciones de Actividades del estudiante con el MISMO diseño que Gestión (Next.js <FilterPanel>)
// Fila: Buscar · Nivel · filtros propios de la sección (<ng-content>) · Filtrar · Limpiar — debajo, las pestañas de idioma
// «Limpiar» vacía búsqueda, nivel e idioma (si admite «Todos») y emite `cleared` → la página vacía sus filtros propios y recarga
// [Patrón]: Atomic Design (molécula) + Two-way binding (`model()`) + Content Projection | [Principio]: DRY (un panel para Práctica, Juegos, Canciones, Diálogos y Lectura) | [A11y]: <section> con nombre, etiquetas visibles, role="search"
// Los filtros propios proyectados usan la clase `filter-field` (misma etiqueta y ancho que Nivel)

@Component({
  selector: 'aula-filter-panel',
  imports: [LanguageChipsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block mb-6' },
  styles: `
    :host ::ng-deep .filter-field { display: block; min-width: 9rem; flex: 1 1 0%; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.025em; color: var(--muted-foreground); }
    :host ::ng-deep .filter-field > select, :host ::ng-deep .filter-field > input { margin-top: 0.25rem; width: 100%; text-transform: none; letter-spacing: normal; font-weight: 400; }
  `,
  template: `
    @let tx = i18n.t().common.filters;
    <section [attr.aria-label]="tx.label" class="surface flex flex-col gap-3 p-4">
      <form class="flex flex-wrap items-end gap-3" role="search" (submit)="$event.preventDefault(); apply.emit()">
        @if (showSearch()) {
          <!-- [searchFull · 2026-11-16]: buscador en su propio renglón al 100 % del panel (Certificados) -->
          <label class="filter-field" style="flex-grow: 2; min-width: 12rem" [style.flex-basis]="searchFull() ? '100%' : null">
            {{ tx.search }}
            <input type="search" class="control" [placeholder]="searchPlaceholder() || tx.searchPlaceholder" [value]="search()" (input)="search.set($any($event.target).value)" />
          </label>
        }
        @if (showLevel()) {
          <label class="filter-field">
            {{ tx.level }}
            <select class="control" [value]="level()" (change)="level.set($any($event.target).value)">
              @if (levelAll()) {
                <option value="">{{ tx.all }}</option>
              }
              @for (l of levels; track l) {
                <option [value]="l" [selected]="l === level()">{{ l }}</option>
              }
            </select>
          </label>
        }
        <ng-content />
        <div class="flex flex-wrap items-center gap-2">
          <button type="submit" class="btn btn-primary">{{ tx.apply }}</button>
          <button type="button" class="btn btn-ghost" (click)="clear()">{{ tx.clear }}</button>
        </div>
      </form>
      @if (showLanguage()) {
        <aula-language-chips [(value)]="language" [label]="tx.language" [allLabel]="tx.all" [allowAll]="languageAll()" />
      }
    </section>
  `,
})
export class FilterPanelComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly levels = CEFR_LEVELS;
  readonly search = model('');
  readonly level = model('');
  readonly language = model('');
  readonly showSearch = input(true);
  readonly showLevel = input(true);
  readonly showLanguage = input(true);
  readonly levelAll = input(true); // false → siempre hay un nivel (p. ej. Diálogos)
  readonly languageAll = input(true); // false → siempre hay un idioma (p. ej. Lectura, Juegos)
  readonly searchPlaceholder = input('');
  readonly searchFull = input(false); // [2026-11-16]: true → el buscador ocupa todo el ancho y los demás filtros bajan al renglón siguiente
  readonly defaultLevel = input(''); // Nivel al que vuelve «Limpiar» cuando no hay «Todos»
  readonly apply = output<void>(); // «Filtrar» (las secciones que cargan del servidor recargan aquí)
  readonly cleared = output<void>(); // «Limpiar» → la página vacía sus filtros propios

  protected clear(): void {
    this.search.set('');
    this.level.set(this.levelAll() ? '' : this.defaultLevel() || this.level());
    if (this.languageAll()) this.language.set('');
    this.cleared.emit();
  }
}
