import { DestroyRef, inject, provideAppInitializer, type EnvironmentProviders } from '@angular/core';
import { AulaEventsService } from '../events/aula-events.service';
import { SessionService } from './session.service';
// [provideAuth · core/auth]: carga la sesión al arrancar y reacciona a `aula:session-expired` | [Patrón]: Facade de providers + Observer | [Principio]: SRP (app.config solo compone) | [Paradigma]: Reactivo

const SESSION_CHECK_MS = 120_000;

// `provideAppInitializer` (Angular 19+): la app espera la sesión antes del primer render → sin parpadeo «anónimo»
export const provideAuth = (): EnvironmentProviders =>
  provideAppInitializer(async () => {
    const session = inject(SessionService);
    const sub = inject(AulaEventsService)
      .on('session-expired')
      .subscribe(() => session.onSessionExpired()); // 401 con sesión abierta → login del shell (anónimo en pantalla pública: se queda)
    // [Vigía de sesión · 2026-10-31]: cada 2 min y al volver a la pestaña → sesión terminada = login sin esperar a que falle una acción (mismo criterio que SessionWatcher de Next.js)
    const check = () => void session.check();
    const timer = setInterval(check, SESSION_CHECK_MS);
    document.addEventListener('visibilitychange', check);
    inject(DestroyRef).onDestroy(() => {
      sub.unsubscribe();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    });
    await session.load();
  });
