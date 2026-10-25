import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { DropdownComponent } from '@shared/ui/molecules/dropdown/dropdown.component';
import { NotificationsFacade } from '../../application/notifications.facade';
import { isInternalHref } from '../../domain/models/notifications';
import { NOTIFICATIONS_PROVIDERS } from '../../notifications.providers';
// [NotificationsMenuComponent]: campana del topbar con panel desplegable — réplica de NotificationsMenu de PortalTopbar.tsx (mismos textos del diccionario de Next.js, contador, lista y «marcar todas») | [Patrón]: Container autónomo (trae sus providers) + Observer (SSE en vivo) | [Principio]: SRP + DRY (misma fachada que la bandeja /notificaciones) | [Paradigma]: Reactivo
// [Uso]: el AppComponent la proyecta dentro de <aula-portal-topbar> → shared no importa funcionalidades (DIP)

@Component({
  selector: 'aula-notifications-menu',
  imports: [NgTemplateOutlet, DropdownComponent, IconComponent],
  providers: NOTIFICATIONS_PROVIDERS,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let t = i18n.shell().topbar;
    @let unread = facade.unread();
    @let items = facade.inbox.data()?.items ?? [];
    <aula-dropdown #dd [label]="t.notifications + (unread ? ' (' + unread + ')' : '')" triggerClass="size-9 justify-center" panelRole="dialog" panelClass="w-80 max-w-[calc(100vw-2rem)]" (opened)="facade.load()">
      <aula-icon trigger name="bell" />
      @if (unread > 0) {
        <span badge class="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-4 text-white" aria-hidden="true">{{ unread > 9 ? '9+' : unread }}</span>
      }
      <div class="flex items-center justify-between border-b border-border px-4 py-2.5">
        <b class="text-sm">{{ t.notifications }}</b>
        @if (unread > 0) {
          <button type="button" (click)="facade.markAllRead()" class="text-[11px] font-semibold text-primary hover:underline">{{ t.markAllRead }}</button>
        }
      </div>
      @if (facade.inbox.status() === 'error') {
        <p class="px-4 py-6 text-center text-xs text-tone-danger">{{ t.notificationsError }}</p>
      } @else if (!items.length) {
        <p class="px-4 py-6 text-center text-xs text-muted-foreground">{{ t.noNotifications }}</p>
      } @else {
        <ul class="max-h-80 overflow-y-auto">
          @for (n of items; track n.id) {
            <li class="border-b border-border last:border-0">
              <ng-template #body>
                <span class="flex items-center gap-1.5 text-xs font-semibold">
                  @if (!n.isRead) {
                    <span class="size-2 shrink-0 rounded-full bg-primary" aria-label="no leída"></span>
                  }
                  {{ n.title }}
                </span>
                <span class="mt-0.5 block text-[11px] text-muted-foreground">{{ n.body }}</span>
                <!-- \`toLocaleString\` (ECMA-402): fecha en el formato del idioma activo -->
                <time [attr.datetime]="n.createdAt" class="mt-1 block text-[10px] text-muted-foreground">{{ date(n.createdAt) }}</time>
              </ng-template>
              @let href = n.payload?.href;
              @if (isInternalHref(href)) {
                <!-- href (no routerLink): el destino puede ser de Next.js o de Angular; mismo origen | [Seguridad]: solo rutas internas -->
                <a [href]="href" (click)="dd.close()" class="block px-4 py-2.5 text-foreground hover:bg-muted"><ng-container [ngTemplateOutlet]="body" /></a>
              } @else {
                <div class="px-4 py-2.5"><ng-container [ngTemplateOutlet]="body" /></div>
              }
            </li>
          }
        </ul>
      }
      <a href="/notificaciones" (click)="dd.close()" class="block border-t border-border px-4 py-2.5 text-center text-xs font-semibold text-primary hover:bg-muted">{{ t.viewAll }}</a>
    </aula-dropdown>
  `,
})
export class NotificationsMenuComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly facade = inject(NotificationsFacade);
  protected readonly isInternalHref = isInternalHref;

  constructor() {
    void this.facade.load(); // [Carga inicial]: el contador aparece sin abrir el menú
    this.facade.connect(inject(DestroyRef)); // [Tiempo real]: SSE ligado a la vida del componente
  }

  protected date(iso: string): string {
    return new Date(iso).toLocaleString(this.i18n.intl());
  }
}
