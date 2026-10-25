import type { IconName } from '@shared/ui/atoms/icon/icon.component';
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
// [GameCardComponent · Presentacional · Sprint 8.8]: tarjeta del catálogo — emoji, nombre, habilidad que entrena, descripción y «Jugar» | [Patrón]: Presentational Component | [Principio]: SRP + DRY | [Paradigma]: Declarativo
// [UX]: toda la tarjeta es el enlace (área táctil grande) y se eleva al pasar/enfocar · [A11y]: un solo enlace por tarjeta con nombre del juego; la habilidad en texto

@Component({
  selector: 'aula-game-card',
  imports: [IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <a
      [routerLink]="link()"
      [queryParams]="query()"
      class="surface group flex h-full flex-col gap-2 p-4 text-foreground no-underline hover:-translate-y-0.5 hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span class="flex items-center justify-between gap-2">
        <span class="grid size-11 place-items-center rounded-xl bg-tone-brand-soft text-tone-brand">
          <aula-icon [name]="icon()" [size]="22" />
        </span>
        @if (mic()) {
          <span class="badge bg-tone-info-soft text-tone-info"><aula-icon name="mic" /> mic</span>
        }
      </span>
      <span class="text-base font-bold">{{ name() }}</span>
      <span class="badge self-start bg-tone-brand-soft text-tone-brand">{{ skill() }}</span>
      <span class="text-sm text-muted-foreground">{{ description() }}</span>
      <span class="mt-auto pt-1 text-sm font-semibold text-primary group-hover:underline"
        >{{ playLabel() }} →</span
      >
    </a>
  `,
})
export class GameCardComponent {
  readonly link = input.required<string>();
  readonly query = input<Record<string, string | number>>({});
  readonly icon = input.required<IconName>(); // [2026-10-23]: icono SVG (antes emoji)
  readonly name = input.required<string>();
  readonly skill = input('');
  readonly description = input('');
  readonly mic = input(false);
  readonly playLabel = input('Jugar');
}
