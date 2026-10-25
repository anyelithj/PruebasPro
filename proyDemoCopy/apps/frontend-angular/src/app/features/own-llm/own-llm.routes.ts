import type { Routes } from '@angular/router';
import { roleGuard } from '@core/auth/role.guard';
import { OwnLlmFacade } from './application/own-llm.facade';
import { OwnLlmRepository } from './domain/own-llm.repository.port';
import { OwnLlmHttpRepository } from './infrastructure/own-llm.http-repository';
// [Rutas OwnLlm]: /redaccion (lazy) + providers de la funcionalidad | [Patrón]: Composition Root por funcionalidad (puerto → adaptador) | [Principio]: DIP + Lazy Loading (rendimiento: el código solo baja al visitar la ruta)

export const OWN_LLM_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard()], // Cualquier usuario con sesión
    title: 'Corrector de redacciones · Aula de Idiomas', // [SEO/A11y]: título de pestaña por ruta (TitleStrategy de Angular)
    providers: [{ provide: OwnLlmRepository, useClass: OwnLlmHttpRepository }, OwnLlmFacade],
    loadComponent: () => import('./presentation/pages/writing-corrector.page'), // `export default` → sin `.then(m => m.X)`
  },
];
