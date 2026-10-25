import { createApplication } from '@angular/platform-browser';
import { createCustomElement } from '@angular/elements';
import { inject } from '@angular/core';
import { coreProviders } from './app.config';
import { NotificationBellElement } from '@features/notifications/presentation/components/notification-bell.element';
import { ReportExportButtonElement } from '@features/reports/presentation/components/report-export-button.element';
import { GuideWidgetElement } from '@features/help/presentation/components/guide-widget.element';
import { IpaTextElement } from '@features/vocabulary/presentation/components/ipa-text.element';
import { WordLookupElement } from '@shared/ui/organisms/word-lookup/word-lookup.element';
import { ThemeService } from '@core/theme/theme.service';
import { VocabularyRepository } from '@features/vocabulary/domain/vocabulary.repository.port';
import { VocabularyHttpRepository } from '@features/vocabulary/infrastructure/vocabulary.http-repository';
import { AulaEventsService } from '@core/events/aula-events.service';
import { SessionService } from '@core/auth/session.service';
// [registerElements · Angular Elements]: registra los Web Components que el shell de Next.js inserta en sus páginas (<aula-campana>, <aula-exportar>, <aula-guia-widget>) | [Patrón]: Adapter (componente Angular → Custom Element) + Registry | [Principio]: OCP (widget nuevo = una entrada en ELEMENTS) + DRY (mismos providers que la app)
// [Tecnología]: @angular/elements + Custom Elements v1 (estándar del navegador) · Next.js carga /ng/main.js (los estilos los genera globals.css de Next con `@source`)

// [Registro]: etiqueta → componente | `as const` (TS)
const ELEMENTS = [
  ['aula-campana', NotificationBellElement],
  ['aula-exportar', ReportExportButtonElement],
  ['aula-guia-widget', GuideWidgetElement], // [Sprint 7.11]: Agente Guía en el layout del portal de Next.js
  ['aula-ipa-text', IpaTextElement], // [Sprint 8.3/8.4]: texto con IPA UK/US, traducción y sonido en recursos y lecciones de Next.js
  ['aula-word-lookup', WordLookupElement], // [Sprints 10.3/10.4]: diccionario al pulsar una palabra en recursos, lecciones y lecturas de Next.js (el puerto lo trae coreProviders)
] as const;

// [registerElements]: crea UNA aplicación sin raíz y define cada etiqueta una sola vez (idempotente si el script se carga dos veces)
export async function registerElements(): Promise<void> {
  // [Puertos de los widgets]: <aula-ipa-text> usa VocabularyFacade → su repositorio HTTP se registra aquí (composition root de los Elements)
  const app = await createApplication({
    providers: [
      ...coreProviders,
      { provide: VocabularyRepository, useClass: VocabularyHttpRepository },
    ],
  });
  app.injector.runInContext(() => {
    inject(ThemeService); // Tema compartido también dentro de los widgets
    const session = inject(SessionService);
    inject(AulaEventsService)
      .on('session-expired')
      .subscribe(() => session.onSessionExpired());
  });
  for (const [tag, component] of ELEMENTS) {
    // `customElements.get` (DOM): evita «NotSupportedError: already defined» en recargas parciales de Next.js
    if (!customElements.get(tag))
      customElements.define(tag, createCustomElement(component, { injector: app.injector }));
  }
}
