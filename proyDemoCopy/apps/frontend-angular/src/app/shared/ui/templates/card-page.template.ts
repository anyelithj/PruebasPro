import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TitleGlossComponent } from '../molecules/title-gloss/title-gloss.component';
// [CardPageTemplate · Plantilla]: página tipo ficha — título (h1), subtítulo, acciones y contenido | [Patrón]: Atomic Design (plantilla) + Content Projection por slots | [Principio]: DRY (todas las pantallas comparten estructura y jerarquía de encabezados) | [SEO/A11y]: un solo <h1> por página
// [Slots]: pageBack (volver, arriba) · pageNav (pills) · pageActions (filtros y botones, debajo del título) · contenido | [Responsive]: flex-wrap → los controles bajan de línea en móvil · [2026-10-23]: sin max-w ni px propios → alineada con la barra superior (el <main> ya da el margen)

@Component({
  selector: 'aula-card-page',
  imports: [TitleGlossComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section class="w-full space-y-5 py-4" [attr.aria-labelledby]="headingId()">
      <!-- [pageBack · 2026-10-23]: enlace «Volver a …» SIEMPRE encima del título (mismo lugar en todas las pantallas, como en Next.js) -->
      <ng-content select="[pageBack]" />
      <!-- [header · 2026-10-23 · 4.º pase]: solo título + subtítulo (antes las acciones iban a su MISMA altura, a la derecha → el usuario las veía pegadas al título) -->
      <header class="min-w-0">
        <!-- [2026-11-10]: título (h1) y artista separados: mismo renglón, alineados por la base; el artista más pequeño, normal y en gris tras un «·» -->
        <div class="flex flex-wrap items-baseline gap-x-2">
          <h1 class="title-page" [id]="headingId()" [attr.lang]="headingLang() || null">{{ heading() }}</h1>
          @if (headingAside()) {
            <p class="title-page !font-normal text-muted-foreground"><span aria-hidden="true">· </span>{{ headingAside() }}</p>
          }
        </div>
        @if (headingAside() && headingLang()) {
          <!-- [2026-11-10 · Canciones]: «Título Artista» · 🔊 /IPA/ · «traducción · idioma · nivel» (el subtítulo va tras la traducción) -->
          <aula-title-gloss class="mt-1" [text]="heading()" [language]="headingLang()" [ipaHint]="headingIpa()" [translationHint]="headingTranslation()" [suffix]="subtitle()" />
        } @else {
          @if (subtitle()) {
            <p class="mt-1 text-muted-foreground">{{ subtitle() }}</p>
          }
          <!-- [2026-11-09]: glosa DESPUÉS del subtítulo (artista · idioma · nivel) y en una sola línea: 🔊 /IPA/ · traducción -->
          @if (headingLang()) {
            <aula-title-gloss class="mt-2" [text]="heading()" [language]="headingLang()" [ipaHint]="headingIpa()" [translationHint]="headingTranslation()" />
          }
        }
      </header>
      <!-- [pageNav]: pills de secciones DEBAJO del título (mismo orden que Recursos de Next.js: título → pills → filtros/acciones) -->
      <ng-content select="[pageNav]" />
      <!-- [pageActions]: barra de filtros y botones debajo del título | \`empty:hidden\` (Tailwind → :empty): sin acciones no deja hueco -->
      <div class="flex flex-wrap items-center gap-2 empty:hidden"><ng-content select="[pageActions]" /></div>
      <!-- [bare · 2026-10-23 · 4.º pase]: sin caja → el contenido va directo en la página, con los mismos espacios que Recursos de Next.js (Actividades) -->
      <div [class]="bare() ? 'space-y-5' : tight() ? 'rounded-2xl border border-border bg-card p-2 shadow-sm sm:p-3' : 'rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6'"><ng-content /></div>
    </section>
  `,
})
export class CardPageTemplate {
  readonly heading = input.required<string>();
  readonly subtitle = input('');
  readonly headingAside = input(''); // [2026-11-10]: texto pequeño junto al título (artista de la canción) → glosa en dos líneas
  readonly headingId = input('page-title');
  readonly headingLang = input('');
  readonly headingIpa = input(''); // [2026-11-10]: glosa ya guardada (canciones) → al instante
  readonly headingTranslation = input(''); // [2026-11-06]: idioma del título ('' = título de la interfaz, sin glosa)
  readonly tight = input(false); // [2026-11-09]: tarjeta con poco relleno lateral (canciones: el contenido usa casi todo el ancho sin perder el contenedor)
  readonly bare = input(false); // true = sin la tarjeta envolvente (secciones de Actividades, igual que Recursos)
}
