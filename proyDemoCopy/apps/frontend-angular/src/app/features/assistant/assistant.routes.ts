import type { Routes } from '@angular/router';
import { roleGuard } from '@core/auth/role.guard';
import { AssistantFacade } from './application/assistant.facade';
import { AssistantRepository } from './domain/assistant.repository.port';
import { AssistantHttpRepository } from './infrastructure/assistant.http-repository';
// [Rutas Assistant]: /tutor (lazy) + providers (puerto → repositorio HTTP) | [Patrón]: Composition Root por funcionalidad | [Principio]: DIP + Lazy Loading

export const ASSISTANT_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard()],
    title: 'Tutor IA · Aula de Idiomas',
    providers: [
      { provide: AssistantRepository, useClass: AssistantHttpRepository },
      AssistantFacade,
    ],
    loadComponent: () => import('./presentation/pages/assistant.page'),
  },
];
