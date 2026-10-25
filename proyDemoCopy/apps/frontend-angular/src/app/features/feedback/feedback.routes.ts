import type { Routes } from '@angular/router';
import { roleGuard } from '@core/auth/role.guard';
import { FeedbackFacade } from './application/feedback.facade';
import { FeedbackRepository } from './domain/feedback.repository.port';
import { FeedbackHttpRepository } from './infrastructure/feedback.http-repository';
// [Rutas Feedback]: /estudio/plan y /estudio/recomendaciones (lazy) con providers en la ruta padre → una fachada para ambas | [Patrón]: Composition Root por funcionalidad | [Principio]: DIP + DRY + Lazy Loading

export const FEEDBACK_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard()],
    providers: [{ provide: FeedbackRepository, useClass: FeedbackHttpRepository }, FeedbackFacade],
    children: [
      { path: 'plan', title: 'Plan de estudio · Aula de Idiomas', loadComponent: () => import('./presentation/pages/study-plan.page') },
      { path: 'recomendaciones', title: 'Recomendaciones · Aula de Idiomas', loadComponent: () => import('./presentation/pages/recommendations.page') },
      { path: '', pathMatch: 'full', redirectTo: 'plan' },
    ],
  },
];
