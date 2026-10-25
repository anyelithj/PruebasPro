import type { Routes } from '@angular/router';
import { roleGuard } from '@core/auth/role.guard';
import { ForumsFacade } from './application/forums.facade';
import { ForumsRepository } from './domain/forums.repository.port';
import { ForumsHttpRepository } from './infrastructure/forums.http-repository';
// [Rutas Forums · Sprint 7.14]: /foros/leccion/:lessonId y /foros/hilo/:id (lazy, con sesión) | [Patrón]: Composition Root por funcionalidad (puerto → adaptador) | [Principio]: DIP + Lazy Loading
// [Integración]: Next.js reescribe /foros (ANGULAR_PREFIXES) · la lección del temario (/courses/:id/path/:lessonId) enlaza aquí

const page = () => import('./presentation/pages/threads.page');

export const FORUMS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard()],
    providers: [{ provide: ForumsRepository, useClass: ForumsHttpRepository }, ForumsFacade],
    children: [
      { path: 'leccion/:lessonId', title: 'Foro de la lección · Aula de Idiomas', loadComponent: page },
      { path: 'hilo/:id', title: 'Hilo del foro · Aula de Idiomas', loadComponent: page },
    ],
  },
];
