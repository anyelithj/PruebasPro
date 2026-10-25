import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { explorerAddressUrl } from '@core/web3/chains';
import { I18nService } from '@core/i18n/i18n.service';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { DataTableComponent, type DataColumn } from '@shared/ui/organisms/data-table/data-table.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { WalletFacade } from '../../application/wallet.facade';
import { sameAddress, shortAddress, type LinkedWallet } from '../../domain/models/wallet';
import { ConnectWalletComponent, type ConnectWalletTexts } from '../components/connect-wallet.component';
// [WalletPage · Presentación]: /wallet (conectar con EIP-6963 + vincular con SIWE + billeteras vinculadas) y /wallet/:address (detalle) | [Patrón]: Container + Máquina de estados | [Principio]: SRP + DIP (fachada) + DRY (DataTable compartida) | [Paradigma]: Declarativo + Reactivo
// [A11y]: errores en role="alert", acciones con nombre por fila, direcciones completas en title · [Responsive]: tarjetas en una columna en móvil

@Component({
  selector: 'aula-wallet-page',
  imports: [CardPageTemplate, ConnectWalletComponent, DataTableComponent, ButtonComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let t = i18n.t().web3;
    <aula-card-page [heading]="t.walletTitle" [subtitle]="t.walletSubtitle">
      <p class="mb-4 text-xs text-muted-foreground">{{ t.network }}</p>
      @if (facade.actionError(); as err) {
        <p role="alert" class="mb-3 text-sm text-tone-danger">{{ err }}</p>
      }
      @if (facade.account(); as acc) {
        <p class="mb-3 text-sm" role="status">{{ i18n.fmt(t.connectedAs, { address: short(acc) }) }}</p>
      }
      @if (selected(); as w) {
        <section aria-labelledby="wallet-detail" class="mb-4 space-y-1 rounded-xl border border-border bg-muted/40 p-4 text-sm">
          <h2 id="wallet-detail" class="font-bold">{{ t.detail }}</h2>
          <p class="eeg-mono break-all">{{ w.address }}</p>
          <p>{{ t.since }}: <time [attr.datetime]="w.linkedAt">{{ date(w.linkedAt) }}</time></p>
          <a class="text-primary hover:underline" [href]="explorer(w.address)" target="_blank" rel="noopener noreferrer">{{ t.explorer }}</a>
        </section>
      }
      <aula-connect-wallet [wallets]="facade.discovered()" [busy]="facade.linking()" [texts]="connectTexts()" (picked)="facade.connectAndLink($event)" (rediscover)="facade.rediscover()" />

      <h2 class="mb-2 mt-6 text-base font-bold">{{ t.linked }}</h2>
      @switch (facade.wallets.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <div role="alert" class="space-y-2 text-sm text-tone-danger">
            <p>{{ facade.wallets.error() }}</p>
            <button aulaButton variant="outline" size="sm" type="button" (click)="facade.load()">{{ i18n.t().common.retry }}</button>
          </div>
        }
        @default {
          <aula-data-table [caption]="t.linked" [columns]="columns()" [rows]="facade.wallets.data() ?? []" [empty]="t.noLinked" [trackBy]="byId">
            <ng-template #cell let-row let-column="column">
              @switch (column) {
                @case ('address') {
                  <a class="eeg-mono text-primary hover:underline" [href]="'/wallet/' + row.address" [title]="row.address">{{ short(row.address) }}</a>
                }
                @case ('linkedAt') {
                  <time [attr.datetime]="row.linkedAt">{{ date(row.linkedAt) }}</time>
                }
                @case ('id') {
                  <button aulaButton variant="ghost" size="sm" type="button" class="text-tone-danger" [attr.aria-label]="t.unlink + ' ' + row.address" (click)="facade.unlink(row.id)">{{ t.unlink }}</button>
                }
              }
            </ng-template>
          </aula-data-table>
        }
      }
    </aula-card-page>
  `,
})
export default class WalletPage {
  protected readonly i18n = inject(I18nService);
  protected readonly facade = inject(WalletFacade);
  readonly address = input<string>(); // /wallet/:address (withComponentInputBinding)
  protected readonly byId = (w: LinkedWallet) => w.id;
  protected readonly short = shortAddress;
  protected readonly selected = computed(() => (this.facade.wallets.data() ?? []).find((w) => sameAddress(w.address, this.address())));

  protected readonly columns = computed<DataColumn<LinkedWallet>[]>(() => {
    const t = this.i18n.t().web3;
    return [
      { key: 'address', header: t.address },
      { key: 'linkedAt', header: t.since },
      { key: 'id', header: this.i18n.t().payments.actions, align: 'end' },
    ];
  });

  protected readonly connectTexts = computed<ConnectWalletTexts>(() => {
    const t = this.i18n.t().web3;
    return { heading: t.discovered, empty: t.noWallets, rediscover: t.rediscover, connect: (name) => (this.facade.linking() ? t.linking : this.i18n.fmt(t.connect, { name })) };
  });

  constructor() {
    void this.facade.load();
  }

  protected date(iso: string): string {
    return new Date(iso).toLocaleString(this.i18n.intl());
  }

  protected explorer(address: string): string {
    return explorerAddressUrl(address);
  }
}
