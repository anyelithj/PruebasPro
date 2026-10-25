import type { Routes } from '@angular/router';
import { roleGuard } from '@core/auth/role.guard';
import { REPORTS_PROVIDERS } from './reports.providers';
// [Rutas Reports]: /reportes/exportaciones (lazy, solo ADMIN — igual que el backend) | [Patrón]: Composition Root por funcionalidad | [Principio]: DIP + Lazy Loading

export const REPORTS_ROUTES: Routes = [
  {
    path: 'exportaciones',
    canActivate: [roleGuard('ADMIN')],
    title: 'Exportaciones de reportes · Aula de Idiomas',
    providers: REPORTS_PROVIDERS,
    loadComponent: () => import('./presentation/pages/report-exports.page'),
  },
  { path: '', pathMatch: 'full', redirectTo: 'exportaciones' },
];
