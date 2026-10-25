import { ChangeDetectionStrategy, Component, input } from '@angular/core';
// [CardPageTemplate · Plantilla]: página tipo ficha — título (h1), subtítulo, acciones y contenido | [Patrón]: Atomic Design (plantilla) + Content Projection por slots | [Principio]: DRY (todas las pantallas comparten estructura y jerarquía de encabezados) | [SEO/A11y]: un solo <h1> por página
// [Slots]: pageBack (volver, arriba) · pageNav (pills) · pageActions (filtros y botones, debajo del título) · contenido | [Responsive]: flex-wrap → los controles bajan de línea en móvil · [2026-10-23]: sin max-w ni px propios → alineada con la barra superior (el <main> ya da el margen)

@Component({
  selector: 'aula-card-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section class="w-full space-y-5 py-4" [attr.aria-labelledby]="headingId()">
      <!-- [pageBack · 2026-10-23]: enlace «Volver a …» SIEMPRE encima del título (mismo lugar en todas las pantallas, como en Next.js) -->
      <ng-content select="[pageBack]" />
      <!-- [header · 2026-10-23 · 4.º pase]: solo título + subtítulo (antes las acciones iban a su MISMA altura, a la derecha → el usuario las veía pegadas al título) -->
      <header class="min-w-0">
        <h1 class="text-2xl font-extrabold tracking-tight sm:text-3xl" [id]="headingId()">{{ heading() }}</h1>
        @if (subtitle()) {
          <p class="mt-1 text-sm text-muted-foreground">{{ subtitle() }}</p>
        }
      </header>
      <!-- [pageNav]: pills de secciones DEBAJO del título (mismo orden que Recursos de Next.js: título → pills → filtros/acciones) -->
      <ng-content select="[pageNav]" />
      <!-- [pageActions]: barra de filtros y botones debajo del título | \`empty:hidden\` (Tailwind → :empty): sin acciones no deja hueco -->
      <div class="flex flex-wrap items-center gap-2 empty:hidden"><ng-content select="[pageActions]" /></div>
      <!-- [bare · 2026-10-23 · 4.º pase]: sin caja → el contenido va directo en la página, con los mismos espacios que Recursos de Next.js (Actividades) -->
      <div [class]="bare() ? 'space-y-5' : 'rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6'"><ng-content /></div>
    </section>
  `,
})
export class CardPageTemplate {
  readonly heading = input.required<string>();
  readonly subtitle = input('');
  readonly headingId = input('page-title');
  readonly bare = input(false); // true = sin la tarjeta envolvente (secciones de Actividades, igual que Recursos)
}
