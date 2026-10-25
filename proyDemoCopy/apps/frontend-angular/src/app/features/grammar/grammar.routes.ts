import type { Routes } from '@angular/router';
import { roleGuard } from '@core/auth/role.guard';
import { GrammarFacade } from './application/grammar.facade';
import { GrammarRepository } from './domain/grammar.repository.port';
import { GrammarHttpRepository } from './infrastructure/grammar.http-repository';
// [Rutas Grammar · Sprints 10.11/10.12]: /gramatica (fichas por idioma y nivel), /gramatica/editor[/:id] (DOCENTE/ADMIN) y /gramatica/:topicId (ficha) — lazy y con sesión | [Patrón]: Composition Root por funcionalidad (puerto → adaptador) | [Principio]: DIP + mínimo privilegio
// [Orden]: «editor» ANTES de «:topicId» · [Integración]: Next.js reescribe /gramatica (ANGULAR_PREFIXES) y el BFF reenvía /api/grammar/*

export const GRAMMAR_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard()],
    providers: [{ provide: GrammarRepository, useClass: GrammarHttpRepository }, GrammarFacade],
    children: [
      {
        path: '',
        title: 'Gramática · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/grammar-list.page'),
      },
      {
        path: 'editor',
        canActivate: [roleGuard('TEACHER', 'ADMIN')],
        title: 'Editor de gramática · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/grammar-editor.page'),
      },
      {
        path: 'editor/:id',
        canActivate: [roleGuard('TEACHER', 'ADMIN')],
        title: 'Editor de gramática · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/grammar-editor.page'),
      },
      {
        path: ':topicId',
        title: 'Ficha de gramática · Aula de Idiomas',
        loadComponent: () => import('./presentation/pages/grammar-topic.page'),
      },
    ],
  },
];
