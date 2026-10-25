import type { Routes } from '@angular/router';
import { roleGuard } from '@core/auth/role.guard';
import { MusicFacade } from './application/music.facade';
import { MusicRepository } from './domain/music.repository.port';
import { MusicHttpRepository } from './infrastructure/music.http-repository';
// [Rutas Music · Sprints 9.8–9.10]: /musica (colecciones y canciones), /musica/coleccion/:id, /musica/cancion/:id (karaoke con avatar), /musica/cancion/:id/practica y /musica/subir[/:id] (solo DOCENTE/ADMIN) — lazy y con sesión | [Patrón]: Composition Root por funcionalidad (puerto → adaptador) | [Principio]: DIP + mínimo privilegio (guard de rol; NestJS vuelve a comprobarlo)
// [Integración]: Next.js reescribe /musica hacia este remoto (ANGULAR_PREFIXES) y el BFF reenvía /api/music/* (Range 206 y subida ≤ 20 MB)

export const MUSIC_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard()],
    providers: [{ provide: MusicRepository, useClass: MusicHttpRepository }, MusicFacade],
    children: [
      {
        path: '',
        title: 'Música · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/music-hub.page'),
      },
      {
        path: 'coleccion/:id',
        title: 'Colección · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/collection-detail.page'),
      },
      {
        path: 'cancion/:id/practica',
        title: 'Practicar con la canción · Aula de Idiomas',
        loadComponent: () =>
          import('./presentation/components/practice-launcher.component').then(
            (m) => m.PracticeLauncherComponent,
          ),
      },
      {
        path: 'cancion/:id',
        title: 'Canción · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/song-player.page'),
      },
      {
        path: 'subir',
        canActivate: [roleGuard('TEACHER', 'ADMIN')],
        title: 'Subir canción · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/song-upload.page'),
      },
      {
        path: 'subir/:id',
        canActivate: [roleGuard('TEACHER', 'ADMIN')],
        title: 'Editar canción · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/song-upload.page'),
      },
    ],
  },
];
