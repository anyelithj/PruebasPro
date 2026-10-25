import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import { BadgeComponent } from '@shared/ui/atoms/badge/badge.component';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { NotificationsFacade } from '../../application/notifications.facade';
import { isInternalHref } from '../../domain/models/notifications';
// [NotificationsPage · Presentación]: bandeja de avisos con no leídos, marcar leído(s) y llegada en vivo | [Patrón]: Container + Máquina de estados (carga/vacío/error/éxito) | [Principio]: SRP + DIP | [Paradigma]: Declarativo + Reactivo
// [A11y]: lista con aria-live (los avisos nuevos se anuncian) · estado leído/no leído con texto, no solo con color

@Component({
  selector: 'aula-notifications-page',
  imports: [CardPageTemplate, ButtonComponent, BadgeComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let t = i18n.t().notifications;
    <aula-card-page [heading]="t.title" [subtitle]="i18n.fmt(t.unread, { n: facade.unread() })">
      <ng-container pageActions>
        <aula-badge tone="info" icon="refresh">{{ i18n.t().common.live }}</aula-badge>
        @if (facade.unread() > 0) {
          <button aulaButton variant="outline" size="sm" type="button" (click)="facade.markAllRead()">{{ t.markAll }}</button>
        }
      </ng-container>

      @switch (facade.inbox.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <div role="alert" class="space-y-2 text-sm text-tone-danger">
            <p>{{ facade.inbox.error() }}</p>
            <button aulaButton variant="outline" size="sm" type="button" (click)="facade.load()">{{ i18n.t().common.retry }}</button>
          </div>
        }
        @case ('empty') {
          <p class="py-6 text-center text-sm text-muted-foreground">{{ t.empty }}</p>
        }
        @default {
          <ul class="divide-y divide-border" aria-live="polite">
            @for (n of facade.inbox.data()?.items ?? []; track n.id) {
              <li class="flex flex-wrap items-start gap-3 py-3">
                <span class="mt-1.5 size-2 shrink-0 rounded-full" [class.bg-primary]="!n.isRead" [class.bg-muted]="n.isRead" aria-hidden="true"></span>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold">
                    {{ n.title }}
                    @if (!n.isRead) {
                      <span class="sr-only">(no leída)</span>
                    }
                  </p>
                  <p class="text-sm text-muted-foreground">{{ n.body }}</p>
                  <time class="text-xs text-muted-foreground" [attr.datetime]="n.createdAt">{{ format(n.createdAt) }}</time>
                </div>
                <div class="flex gap-2">
                  @if (internal(n.payload?.href); as href) {
                    <a aulaButton variant="ghost" size="sm" [href]="href">{{ t.open }}</a>
                  }
                  @if (!n.isRead) {
                    <button aulaButton variant="outline" size="sm" type="button" (click)="facade.markRead(n.id)">{{ t.markRead }}</button>
                  }
                </div>
              </li>
            }
          </ul>
        }
      }
    </aula-card-page>
  `,
})
export default class NotificationsPage {
  protected readonly i18n = inject(I18nService);
  protected readonly facade = inject(NotificationsFacade);

  constructor() {
    void this.facade.load();
    this.facade.connect(inject(DestroyRef));
  }

  // [internal]: href solo si es interno (o null → la plantilla no muestra el enlace) | [Seguridad]: sin open redirect
  protected internal(href: string | undefined): string | null {
    return isInternalHref(href) ? href : null;
  }

  // `toLocaleString` (ECMA-402): fecha en el formato del idioma activo
  protected format(iso: string): string {
    return new Date(iso).toLocaleString(this.i18n.intl());
  }
}
