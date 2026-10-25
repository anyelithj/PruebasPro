import { ChangeDetectionStrategy, Component, DestroyRef, inject, input } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { NotificationsFacade } from '../../application/notifications.facade';
import { NOTIFICATIONS_PROVIDERS } from '../../notifications.providers';
// [NotificationBellElement · Angular Element <aula-campana>]: icono con contador de no leídas que se actualiza en vivo (SSE) y lleva a la bandeja | [Patrón]: Container autónomo (trae sus providers → funciona como Custom Element fuera del router) + Observer | [Principio]: SRP + DRY (misma fachada que la bandeja) | [Paradigma]: Reactivo
// [Uso]: cabecera de las pantallas Angular y, como Web Component, cualquier página del shell Next.js
// [A11y]: el enlace lleva el número en su nombre accesible; el globo visual es aria-hidden

@Component({
  selector: 'aula-notification-bell',
  imports: [IconComponent],
  providers: NOTIFICATIONS_PROVIDERS, // Instancia propia: no depende de la ruta /notificaciones
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let t = i18n.t().notifications;
    <a [href]="href()" class="btn btn-ghost btn-sm relative size-9 justify-center px-0!" [attr.aria-label]="t.title + (facade.unread() ? ' — ' + i18n.fmt(t.unread, { n: facade.unread() }) : '')">
      <aula-icon name="bell" />
      @if (facade.unread() > 0) {
        <span class="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-4 text-white" aria-hidden="true">
          {{ facade.unread() > 9 ? '9+' : facade.unread() }}
        </span>
      }
    </a>
  `,
})
export class NotificationBellElement {
  protected readonly i18n = inject(I18nService);
  protected readonly facade = inject(NotificationsFacade);
  // `input` → atributo `href` del Custom Element (por defecto, la bandeja Angular)
  readonly href = input('/notificaciones');

  constructor() {
    void this.facade.load();
    this.facade.connect(inject(DestroyRef)); // Se cierra el SSE cuando el elemento sale del DOM
  }
}
