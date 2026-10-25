import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { DiscoveredWallet } from '@core/web3/viem-client';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
// [ConnectWalletComponent · Presentacional]: lista las billeteras descubiertas por EIP-6963 (icono + nombre) y emite la elegida | [Patrón]: Presentational Component (input()/output()) | [Principio]: SRP (no conecta ni firma: lo hace la fachada) | [Paradigma]: Declarativo
// [A11y]: un botón real por billetera con nombre accesible («Conectar con MetaMask») · icono decorativo con alt vacío · estado de espera con aria-busy

export interface ConnectWalletTexts {
  heading: string;
  empty: string;
  rediscover: string;
  connect: (name: string) => string;
}

@Component({
  selector: 'aula-connect-wallet',
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let t = texts();
    <section aria-labelledby="connect-wallet-title" class="space-y-3">
      <h2 id="connect-wallet-title" class="text-base font-bold">{{ t.heading }}</h2>
      @if (!wallets().length) {
        <p class="text-sm text-muted-foreground">{{ t.empty }}</p>
      } @else {
        <ul class="grid gap-2 sm:grid-cols-2">
          @for (w of wallets(); track w.info.uuid) {
            <li>
              <button aulaButton variant="outline" type="button" class="w-full justify-start" [loading]="busy()" (click)="picked.emit(w)">
                <!-- [Seguridad]: el icono es un data URI que publica la billetera; [src] con data: es inerte (no ejecuta script en <img>) -->
                <img [src]="w.info.icon" alt="" width="20" height="20" class="size-5 rounded" />
                {{ t.connect(w.info.name) }}
              </button>
            </li>
          }
        </ul>
      }
      <button aulaButton variant="ghost" size="sm" type="button" (click)="rediscover.emit()">{{ t.rediscover }}</button>
    </section>
  `,
})
export class ConnectWalletComponent {
  readonly wallets = input.required<readonly DiscoveredWallet[]>();
  readonly busy = input(false);
  readonly texts = input.required<ConnectWalletTexts>();
  readonly picked = output<DiscoveredWallet>();
  readonly rediscover = output<void>();
}
