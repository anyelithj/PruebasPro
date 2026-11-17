import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BackLinkComponent } from '@shared/ui/atoms/back-link/back-link.component';
// [NotFoundPage · 2026-11-16]: 404 del remoto Angular (antes '**' redirigía a /tutor y ocultaba el enlace roto) | [Patrón]: Null Object | [Principio]: SRP
// Mismo diseño que app/not-found.tsx de Next.js (404 grande + texto + «Volver al inicio») | [A11y]: <h1> único + enlace con texto

@Component({
  selector: 'aula-not-found-page',
  imports: [RouterLink, BackLinkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="grid min-h-[60vh] place-items-center p-6">
      <div class="max-w-md space-y-4 text-center">
        <h1 class="title-display text-gradient-brand">404</h1>
        <p class="title-section">Página no encontrada</p>
        <p class="text-muted-foreground">La ruta que buscas no existe o fue movida.</p>
        <a aulaBackLink routerLink="/tutor">Volver al inicio</a>
      </div>
    </section>
  `,
})
export default class NotFoundPage {}
