import { APP_BASE_HREF } from '@angular/common';
import { provideBrowserGlobalErrorListeners, provideZonelessChangeDetection, type ApplicationConfig } from '@angular/core';
import { PreloadAllModules, provideRouter, withComponentInputBinding, withInMemoryScrolling, withPreloading } from '@angular/router';
import { provideAuth } from '@core/auth/auth.providers';
import { provideHttp } from '@core/http/http.providers';
import { DictionaryRepository } from '@core/dictionary/dictionary.repository.port';
import { DictionaryHttpRepository } from '@core/dictionary/dictionary.http-repository';
import { routes } from './app.routes';
// [appConfig · Angular 22]: providers globales — router, HttpClient, sesión, sin zone.js | [Patrón]: Composition Root | [Principio]: SRP (cada core/* aporta su provide*) + OCP | [Paradigma]: Declarativo
// [Rendimiento]: zoneless → detección de cambios guiada por signals (sin parchear APIs del navegador)

// `providers: [...]` compartidos con los Angular Elements (elements.ts) → mismo HTTP y misma sesión | [Principio]: DRY
export const coreProviders = [
  provideBrowserGlobalErrorListeners(),
  provideZonelessChangeDetection(),
  provideHttp(),
  // [Sprint 10.3]: diccionario al pulsar una palabra — lo usan todas las funcionalidades y <aula-word-lookup> (puerto → adaptador en el composition root)
  { provide: DictionaryRepository, useClass: DictionaryHttpRepository },
];

export const appConfig: ApplicationConfig = {
  providers: [
    ...coreProviders,
    provideAuth(),
    // [base]: rutas desde "/" aunque los assets vengan de /ng/ (deployUrl) → /tutor, /redaccion… coinciden con los rewrites de Next.js
    { provide: APP_BASE_HREF, useValue: '/' },
    // `withComponentInputBinding` (Angular): params de ruta → inputs del componente · `withInMemoryScrolling`: vuelve arriba al navegar y baja al #ancla (secciones del manual, Sprint 7.11)
    // [withPreloading · 2026-10-24]: tras la primera pantalla, Angular descarga en segundo plano el resto de funcionalidades lazy → cambiar de sección dentro del remoto no espera la red | [Patrón]: Preloading Strategy
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }), withPreloading(PreloadAllModules)),
  ],
};
