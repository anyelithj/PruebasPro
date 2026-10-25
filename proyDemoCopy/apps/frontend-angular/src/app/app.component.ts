import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { SessionService } from '@core/auth/session.service';
import { I18nService } from '@core/i18n/i18n.service';
import { PortalNavService } from '@core/layout/portal-nav.service';
import { ThemeService } from '@core/theme/theme.service';
import { PortalSidebarComponent } from '@shared/ui/organisms/portal-sidebar/portal-sidebar.component';
import { PortalTopbarComponent } from '@shared/ui/organisms/portal-topbar/portal-topbar.component';
import { ToasterComponent } from '@shared/ui/organisms/toaster/toaster.component';
import { NotificationsMenuComponent } from '@features/notifications/presentation/components/notifications-menu.component'; // La app compone funcionalidades; ellas no se importan entre sí
import { GuideWidgetElement } from '@features/help/presentation/components/guide-widget.element'; // [Sprint 7.11]: Agente Guía flotante (el mismo <aula-guia-widget> que pinta Next.js)
// [AppComponent · raíz standalone]: el MISMO marco del portal de Next.js ((portal)/layout.tsx): sidebar + topbar + contenido → para el usuario es una sola aplicación | [Patrón]: Composite + Shell + Content Projection (la campana entra en el topbar) | [Principio]: SRP (cada pantalla vive en su funcionalidad) + DRY (menú, textos y temas del SSOT de Next.js) | [Paradigma]: Declarativo
// [A11y]: enlace «saltar al contenido» · <main> con id de destino
// [Visitante]: sin sesión solo se llega a pantallas públicas (/verificar) → contenido sin sidebar ni topbar (el menú es del portal)
// [Responsive]: sidebar fijo en columna desde lg (≥1024px); por debajo es un drawer → el contenido usa todo el ancho en móvil y tablet

@Component({
  selector: 'aula-root',
  imports: [RouterOutlet, PortalSidebarComponent, PortalTopbarComponent, NotificationsMenuComponent, GuideWidgetElement, ToasterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- [Loader de navegación · 2026-10-23]: barra superior mientras carga la siguiente pantalla (lazy chunk + resolvers) → el usuario sabe que la app está trabajando -->
    @if (navigating()) {
      <div class="fixed inset-x-0 top-0 z-[70] h-1 overflow-hidden bg-primary/15" role="progressbar" [attr.aria-label]="i18n.t().common.loading">
        <div class="h-full w-1/3 bg-gradient-brand motion-safe:animate-[nav-progress_1s_ease-in-out_infinite]"></div>
      </div>
    }
    <a href="#main-content" (click)="skip($event)" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 btn btn-primary btn-sm">{{ i18n.t().common.skipToContent }}</a>
    @if (session.isAuthenticated()) {
      <!-- [PortalFrame]: rejilla igual a la de Next.js; contraído, la columna pasa de 260px al riel de 72px -->
      <div class="min-h-screen bg-background motion-safe:transition-[grid-template-columns] lg:grid" [class]="menu.collapsed() ? 'lg:grid-cols-[72px_1fr]' : 'lg:grid-cols-[260px_1fr]'">
        <aula-portal-sidebar />
        <main id="main-content" tabindex="-1" class="flex min-w-0 flex-col px-4 pb-10 outline-none md:px-8">
          <aula-portal-topbar>
            <aula-notifications-menu />
          </aula-portal-topbar>
          <router-outlet />
        </main>
      </div>
      <aula-guide-widget />
      <aula-toaster />
    } @else {
      <main id="main-content" tabindex="-1" class="min-h-screen bg-background px-4 pb-10 outline-none md:px-8">
        <a href="/" class="mx-auto flex max-w-5xl items-center gap-2 pt-6 text-lg font-bold">Aula de Idiomas</a>
        <router-outlet />
      </main>
    }
  `,
})
export class AppComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly menu = inject(PortalNavService);
  protected readonly session = inject(SessionService);
  // Instanciar ThemeService aplica y sincroniza el tema compartido con Next.js
  private readonly theme = inject(ThemeService);
  // [navigating]: true entre NavigationStart y su fin (ok, cancelada o con error) | `toSignal` (RxJS → Signals) | [Patrón]: Observer
  protected readonly navigating = toSignal(
    inject(Router).events.pipe(
      filter((e) => e instanceof NavigationStart || e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError),
      map((e) => e instanceof NavigationStart),
    ),
    { initialValue: false },
  );

  // [skip]: con <base href="/ng/"> un «#main-content» relativo navegaría a /ng/ → se enfoca <main> a mano (mismo efecto que el ancla) | [A11y]: WCAG 2.4.1
  protected skip(e: Event): void {
    e.preventDefault();
    document.getElementById('main-content')?.focus();
  }
}
