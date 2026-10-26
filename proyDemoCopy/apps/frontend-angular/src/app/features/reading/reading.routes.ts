import type { Routes } from '@angular/router';
import { roleGuard } from '@core/auth/role.guard';
import { ReadingFacade } from './application/reading.facade';
import { ReadingRepository } from './domain/reading.repository.port';
import { ReadingHttpRepository } from './infrastructure/reading.http-repository';
// [Rutas Reading · Lectura · 2026-10-25]: /lectura (lista con filtros) y /lectura/:id (lector) — lazy y con sesión; crear/editar viven en Gestión de Next.js | [Patrón]: Composition Root por funcionalidad (puerto → adaptador) | [Principio]: DIP + mínimo privilegio

export const READING_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard()],
    providers: [{ provide: ReadingRepository, useClass: ReadingHttpRepository }, ReadingFacade],
    children: [
      {
        path: '',
        title: 'Lectura · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/reading-list.page'),
      },
      {
        path: ':id',
        title: 'Leer · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/reading-reader.page'),
      },
    ],
  },
];
