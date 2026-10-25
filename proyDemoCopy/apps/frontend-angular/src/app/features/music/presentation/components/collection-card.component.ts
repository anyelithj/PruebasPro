import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LevelTintDirective } from '@shared/ui/atoms/level-tint/level-tint.directive';
// [CollectionCardComponent · Presentacional · Sprint 9.8 · RF-115]: tarjeta de colección — emoji, nombre, idioma, nivel (en texto y color del nivel MCER) y número de canciones | [Patrón]: Presentational Component | [Principio]: SRP + DRY (mismo estilo `surface` que las tarjetas de juegos) | [Paradigma]: Declarativo
// [UX]: toda la tarjeta es el enlace y se eleva al pasar/enfocar · [A11y]: el nivel nunca solo por color

@Component({
  selector: 'aula-collection-card',
  imports: [IconComponent, RouterLink, LevelTintDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <a
      [routerLink]="['/musica/coleccion', id()]"
      [aulaLevel]="level()"
      class="surface group flex h-full flex-col gap-2 border-l-4 border-l-(--lvl) p-4 text-foreground no-underline hover:-translate-y-0.5 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        class="grid size-12 place-items-center rounded-xl bg-gradient-soft text-2xl"
        aria-hidden="true"
        >{{ emoji() }}</span
      >
      <span class="text-base font-bold group-hover:underline">{{ title() }}</span>
      <span class="flex flex-wrap gap-1.5 text-xs">
        <span class="badge bg-tone-brand-soft text-tone-brand">{{ languageName() }}</span>
        @if (level()) {
          <span class="badge bg-muted font-bold">{{ level() }}</span>
        }
        @if (theme()) {
          <span class="badge bg-muted">{{ theme() }}</span>
        }
      </span>
      @if (description()) {
        <span class="line-clamp-2 text-sm text-muted-foreground">{{ description() }}</span>
      }
      <span class="mt-auto pt-1 text-sm font-semibold text-primary"><aula-icon name="music" /> {{ countLabel() }}</span>
    </a>
  `,
})
export class CollectionCardComponent {
  readonly id = input.required<string>();
  readonly title = input.required<string>();
  readonly emoji = input('🎵');
  readonly languageName = input.required<string>();
  readonly level = input<string | null>(null);
  readonly theme = input<string | null>(null);
  readonly description = input('');
  readonly countLabel = input('');
}
