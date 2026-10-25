import type { Provider } from '@angular/core';
import type { Routes } from '@angular/router';
import { roleGuard } from '@core/auth/role.guard';
import { GuideFacade } from './application/guide.facade';
import { HelpFacade } from './application/help.facade';
import { HelpRepository } from './domain/help.repository.port';
import { HelpHttpRepository } from './infrastructure/help.http-repository';
// [Rutas Help · Sprint 7.11]: /ayuda/faq y /ayuda/faq/:id (PÚBLICAS) · /ayuda/manual y /ayuda/manual/:slug (con sesión) — lazy | [Patrón]: Composition Root por funcionalidad (puerto → adaptador) | [Principio]: DIP + Lazy Loading + mínimo privilegio (guard = UX; NestJS exige el JWT)
// [Integración]: Next.js reescribe /ayuda (ANGULAR_PUBLIC_PREFIXES: la FAQ es pública, RF-94) · <aula-guia-widget> reutiliza HELP_PROVIDERS

export const HELP_PROVIDERS: Provider[] = [{ provide: HelpRepository, useClass: HelpHttpRepository }, HelpFacade, GuideFacade];
const faq = () => import('./presentation/pages/faq.page');

export const HELP_ROUTES: Routes = [
  {
    path: '',
    providers: HELP_PROVIDERS,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'faq' },
      { path: 'faq', title: 'Preguntas frecuentes · Aula de Idiomas', loadComponent: faq },
      { path: 'faq/:id', title: 'Preguntas frecuentes · Aula de Idiomas', loadComponent: faq },
      { path: 'manual', canActivate: [roleGuard()], title: 'Manual de usuario · Aula de Idiomas', loadComponent: () => import('./presentation/pages/manual.page') },
      { path: 'manual/:slug', canActivate: [roleGuard()], title: 'Manual de usuario · Aula de Idiomas', loadComponent: () => import('./presentation/pages/manual-article.page') },
    ],
  },
];
