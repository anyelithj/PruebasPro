import type { Routes } from '@angular/router';
import { roleGuard } from '@core/auth/role.guard';
import { __Name__Facade } from './application/__name__.facade';
import { __Name__Repository } from './domain/__name__.repository.port';
import { __Name__HttpRepository } from './infrastructure/__name__.http-repository';
// [Plantilla · Rutas]: ruta lazy + providers (puerto → adaptador); registrar en app.routes.ts y en ANGULAR_ROUTES de apps/frontend-next/next.config.ts | [Patrón]: Composition Root | [Principio]: DIP + Lazy Loading

export const __NAME___ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard()],
    providers: [{ provide: __Name__Repository, useClass: __Name__HttpRepository }, __Name__Facade],
    loadComponent: () => import('./presentation/pages/__name__.page'),
  },
];
