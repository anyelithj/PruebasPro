import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { __Name__Facade } from '../../application/__name__.facade';
// [Plantilla · Página contenedora]: inyecta la fachada (sin HTTP) y pinta la máquina de estados | [Patrón]: Container | [Principio]: SRP + DIP | [Paradigma]: Declarativo

@Component({
  selector: 'aula-__name__-page',
  imports: [CardPageTemplate, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aula-card-page heading="__Name__">
      @switch (facade.items.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <p role="alert" class="text-sm text-tone-danger">{{ facade.items.error() }}</p>
        }
        @case ('empty') {
          <p class="text-sm text-muted-foreground">—</p>
        }
        @default {
          <ul>
            @for (item of facade.items.data() ?? []; track item.id) {
              <li>{{ item.title }}</li>
            }
          </ul>
        }
      }
    </aula-card-page>
  `,
})
export default class __Name__Page {
  protected readonly i18n = inject(I18nService);
  protected readonly facade = inject(__Name__Facade);

  constructor() {
    void this.facade.load();
  }
}
