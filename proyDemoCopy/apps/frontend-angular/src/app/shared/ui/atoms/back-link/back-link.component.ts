import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
// [BackLinkComponent · Átomo · 2026-10-23]: enlace «volver» ÚNICO del remoto — flecha + texto, con aspecto de ENLACE (no de botón); espejo de <BackLink> de Next.js
// [Uso]: <a aulaBackLink routerLink="/musica">{{ tx.back }}</a> · el `<a>` sigue siendo del contenedor (routerLink, href…) → solo cambia el aspecto
// [Patrón]: Atomic Design (átomo) + Attribute Component (selector `a[aulaBackLink]`) | [Principio]: DRY + consistencia visual | [A11y]: icono decorativo, foco visible

@Component({
  selector: 'a[aulaBackLink]',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'inline-flex w-fit items-center gap-2 rounded text-sm font-semibold text-muted-foreground no-underline transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  },
  template: `<aula-icon name="arrowLeft" /><ng-content />`,
})
export class BackLinkComponent {}
