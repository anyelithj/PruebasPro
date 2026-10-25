import type { Routes } from '@angular/router';
import { roleGuard } from '@core/auth/role.guard';
import { DialoguesFacade } from './application/dialogues.facade';
import { DialoguesRepository } from './domain/dialogues.repository.port';
import { DialoguesHttpRepository } from './infrastructure/dialogues.http-repository';
// [Rutas Dialogues · Sprints 9.11–9.13]: /dialogos (temas e historial), /dialogos/biblioteca, /dialogos/conversar/:topicId (avatar), /dialogos/sesion/:id (transcripción), /dialogos/subir[/:id] (DOCENTE/ADMIN) y /dialogos/:id (diálogo guionado) — lazy y con sesión | [Patrón]: Composition Root por funcionalidad (puerto → adaptador) | [Principio]: DIP + mínimo privilegio
// [Orden]: rutas fijas («biblioteca», «subir», «conversar», «sesion») ANTES de «:id»

export const DIALOGUES_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard()],
    providers: [
      { provide: DialoguesRepository, useClass: DialoguesHttpRepository },
      DialoguesFacade,
    ],
    children: [
      {
        path: '',
        title: 'Diálogos · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/dialogue-hub.page'),
      },
      {
        path: 'biblioteca',
        title: 'Biblioteca de diálogos · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/dialogue-library.page'),
      },
      {
        path: 'conversar/:topicId',
        title: 'Conversar con el avatar · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/avatar-conversation.page'),
      },
      {
        path: 'sesion/:id',
        title: 'Transcripción · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/avatar-conversation.page'),
      },
      {
        path: 'subir',
        canActivate: [roleGuard('TEACHER', 'ADMIN')],
        title: 'Subir diálogo · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/dialogue-upload.page'),
      },
      {
        path: 'subir/:id',
        canActivate: [roleGuard('TEACHER', 'ADMIN')],
        title: 'Nivel del diálogo · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/dialogue-upload.page'),
      },
      {
        path: ':id',
        title: 'Practicar diálogo · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/dialogue-player.page'),
      },
    ],
  },
];
