import type { Routes } from '@angular/router';
import { roleGuard } from '@core/auth/role.guard';
import { VocabularyEntryFacade } from './application/vocabulary-entry.facade';
import { VocabularyFacade } from './application/vocabulary.facade';
import { VocabularyRepository } from './domain/vocabulary.repository.port';
import { VocabularyHttpRepository } from './infrastructure/vocabulary.http-repository';
// [Rutas Vocabulary · Sprint 8.3]: /traductor (traducción + IPA UK/US) y /vocabulario[/:id] (banco de vocabulario) — lazy y con sesión | [Patrón]: Composition Root por funcionalidad (puerto → adaptador) | [Principio]: DIP + Lazy Loading
// [Integración]: Next.js reescribe /traductor y /vocabulario (ANGULAR_PREFIXES) · dos exportaciones, una por prefijo (como payments y web3)

const providers = [
  { provide: VocabularyRepository, useClass: VocabularyHttpRepository },
  VocabularyFacade,
  VocabularyEntryFacade,
];

export const TRANSLATOR_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard()],
    providers,
    title: 'Traductor con IPA · Aula de Idiomas',
    loadComponent: () => import('./presentation/pages/language-lookup.page'),
  },
];

export const VOCABULARY_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard()],
    providers,
    children: [
      {
        path: '',
        title: 'Mi vocabulario · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/vocabulary-entry.page'),
      },
      {
        path: ':id',
        title: 'Corregir término · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/vocabulary-entry.page'),
      },
    ],
  },
];
