import type { Routes } from '@angular/router';
import { roleGuard } from '@core/auth/role.guard';
import { PolyglotFacade } from './application/polyglot.facade';
import { PolyglotRepository } from './domain/polyglot.repository.port';
import { PolyglotHttpRepository } from './infrastructure/polyglot.http-repository';
// [Rutas Polyglot · Sprints 10.7/10.8]: /poliglota (tabla comparativa por tema e idiomas) y /poliglota/administrar[/:id] (solo DOCENTE/ADMIN) — lazy y con sesión | [Patrón]: Composition Root por funcionalidad (puerto → adaptador) | [Principio]: DIP + mínimo privilegio (guard de rol; NestJS vuelve a comprobarlo)
// [Integración]: Next.js reescribe /poliglota hacia este remoto (ANGULAR_PREFIXES) y el BFF reenvía /api/polyglot/* · Recursos la ofrece junto a los siete idiomas (PolyglotNavLink)

export const POLYGLOT_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard()],
    providers: [{ provide: PolyglotRepository, useClass: PolyglotHttpRepository }, PolyglotFacade],
    children: [
      {
        path: '',
        title: 'Poliglota · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/polyglot.page'),
      },
      {
        path: 'administrar',
        canActivate: [roleGuard('TEACHER', 'ADMIN')],
        title: 'Administrar Poliglota · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/polyglot-builder.page'),
      },
      {
        path: 'administrar/:id',
        canActivate: [roleGuard('TEACHER', 'ADMIN')],
        title: 'Administrar Poliglota · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/polyglot-builder.page'),
      },
    ],
  },
];
