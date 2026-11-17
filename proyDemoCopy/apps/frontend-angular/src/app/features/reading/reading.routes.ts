import type { Routes } from '@angular/router';
import { roleGuard } from '@core/auth/role.guard';
import { ReadingFacade } from './application/reading.facade';
import { ReadingRepository } from './domain/reading.repository.port';
import { ReadingHttpRepository } from './infrastructure/reading.http-repository';
import { BooksFacade } from './application/books.facade';
import { BooksRepository } from './domain/books.repository.port';
import { BooksHttpRepository } from './infrastructure/books.http-repository';
// [Rutas Reading · Lectura · 2026-10-25]: /lectura (lista con filtros) y /lectura/:id (lector) — lazy y con sesión; crear/editar viven en Gestión de Next.js | [Patrón]: Composition Root por funcionalidad (puerto → adaptador) | [Principio]: DIP + mínimo privilegio

export const READING_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard()],
    providers: [
      { provide: ReadingRepository, useClass: ReadingHttpRepository },
      ReadingFacade,
      { provide: BooksRepository, useClass: BooksHttpRepository }, // [2026-11-14 · Libros]
      BooksFacade,
    ],
    children: [
      {
        path: '',
        title: 'Lectura · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/reading-list.page'),
      },
      // [2026-11-16 · Dictado]: escuchar la frase, escribirla y recibir la corrección (antes de ':id')
      {
        path: 'dictado',
        title: 'Dictado · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/dictation.page'),
      },
      // [2026-11-14 · Libros · RF-145/146]: antes de ':id' para que «libros» no se tome como id de una lectura
      {
        path: 'libros',
        title: 'Libros clásicos · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/books-list.page'),
      },
      {
        path: 'libros/:id',
        title: 'Leer libro · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/book-reader.page'),
      },
      {
        path: ':id',
        title: 'Leer · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/reading-reader.page'),
      },
    ],
  },
];
