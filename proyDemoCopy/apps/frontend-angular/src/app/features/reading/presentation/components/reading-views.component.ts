import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import { PillNavComponent, type PillItem } from '@shared/ui/molecules/pill-nav/pill-nav.component';
// [ReadingViewsComponent · 2026-11-16]: pills de las vistas de Lectura — Lecturas · Dictado · Libros clásicos (mismo átomo que las secciones de Actividades)
// `exact`: «/lectura» no queda activa dentro de «/lectura/dictado» | [Patrón]: Composite (reutiliza PillNav) | [Principio]: DRY (las tres pantallas comparten la misma barra)

@Component({
  selector: 'aula-reading-views',
  imports: [PillNavComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<aula-pill-nav [items]="items()" [label]="i18n.t().reading.views" [exact]="true" />`,
})
export class ReadingViewsComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly items = computed<PillItem[]>(() => {
    const t = this.i18n.t();
    return [
      { label: t.reading.title, link: '/lectura', icon: 'book-open' },
      { label: t.dictation.link, link: '/lectura/dictado', icon: 'pen-line' },
      { label: t.books.link, link: '/lectura/libros', icon: 'library' },
    ];
  });
}
