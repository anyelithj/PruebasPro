import type { Routes } from '@angular/router';
import { roleGuard } from '@core/auth/role.guard';
import { NOTIFICATIONS_PROVIDERS } from './notifications.providers';
// [Rutas Notifications]: /notificaciones (lazy) + providers (puerto → repositorio HTTP) | [Patrón]: Composition Root por funcionalidad | [Principio]: DIP + Lazy Loading

export const NOTIFICATIONS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard()],
    title: 'Notificaciones · Aula de Idiomas',
    providers: NOTIFICATIONS_PROVIDERS,
    loadComponent: () => import('./presentation/pages/notifications.page'),
  },
];
