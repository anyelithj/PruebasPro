import { ChangeDetectionStrategy, Component } from '@angular/core';
// [TwoColumnTemplate · Plantilla]: dos columnas (p. ej. texto original + corrección) que se apilan en móvil | [Patrón]: Atomic Design (plantilla) + Content Projection (`[left]` / `[right]`) | [Principio]: DRY + SRP | [Responsive]: 1 columna < md, 2 columnas ≥ md

@Component({
  selector: 'aula-two-column',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'grid gap-4 md:grid-cols-2' },
  template: `
    <div class="min-w-0 space-y-2"><ng-content select="[left]" /></div>
    <div class="min-w-0 space-y-2"><ng-content select="[right]" /></div>
  `,
})
export class TwoColumnTemplate {}
