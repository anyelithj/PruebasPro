import type { Routes } from '@angular/router';
import { roleGuard } from '@core/auth/role.guard';
import { ActivityBuilderFacade } from './application/activity-builder.facade';
import { PracticeFacade } from './application/practice.facade';
import { PracticeRepository } from './domain/practice.repository.port';
import { PracticeHttpRepository } from './infrastructure/practice.http-repository';
import { IPA_TEXT_PROVIDERS } from '@features/vocabulary/ipa-text.providers'; // [2026-10-28]: <aula-say> (IPA + traducción + sonido) en los ítems
// [Rutas Practice · Sprints 8.14/8.15]: /practica (lista), /practica/:activityId (reproductor con corrección) y /practica/constructor[/:id] (solo DOCENTE/ADMIN) — lazy y con sesión | [Patrón]: Composition Root por funcionalidad (puerto → adaptador) | [Principio]: DIP + mínimo privilegio (guard de rol; NestJS vuelve a comprobarlo)
// [Orden]: «constructor» va ANTES de «:activityId» (ruta más específica primero)

export const PRACTICE_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard()],
    providers: [
      { provide: PracticeRepository, useClass: PracticeHttpRepository },
      PracticeFacade,
      ActivityBuilderFacade,
      ...IPA_TEXT_PROVIDERS, // `...` (ES2015): puerto del vocabulario + caché de IPA compartida por la ruta
    ],
    children: [
      {
        path: '',
        title: 'Práctica interactiva · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/practice-list.page'),
      },
      {
        path: 'constructor',
        canActivate: [roleGuard('TEACHER', 'ADMIN')],
        title: 'Constructor de actividades · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/activity-builder.page'),
      },
      {
        path: 'constructor/:id',
        canActivate: [roleGuard('TEACHER', 'ADMIN')],
        title: 'Editar actividad · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/activity-builder.page'),
      },
      {
        path: ':activityId',
        title: 'Practicar · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/practice-player.page'),
      },
    ],
  },
];
