import { DestroyRef, inject, provideAppInitializer, type EnvironmentProviders } from '@angular/core';
import { AulaEventsService } from '../events/aula-events.service';
import { SessionService } from './session.service';
// [provideAuth · core/auth]: carga la sesión al arrancar y reacciona a `aula:session-expired` | [Patrón]: Facade de providers + Observer | [Principio]: SRP (app.config solo compone) | [Paradigma]: Reactivo

// `provideAppInitializer` (Angular 19+): la app espera la sesión antes del primer render → sin parpadeo «anónimo»
export const provideAuth = (): EnvironmentProviders =>
  provideAppInitializer(async () => {
    const session = inject(SessionService);
    const sub = inject(AulaEventsService)
      .on('session-expired')
      .subscribe(() => session.onSessionExpired()); // 401 con sesión abierta → login del shell (anónimo en pantalla pública: se queda)
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
    await session.load();
  });
