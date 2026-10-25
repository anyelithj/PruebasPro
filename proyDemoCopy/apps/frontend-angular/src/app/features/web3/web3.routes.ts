import type { Provider } from '@angular/core';
import type { Routes } from '@angular/router';
import { CryptoPaymentFacade } from './application/crypto-payment.facade';
import { WalletFacade } from './application/wallet.facade';
import { WalletRepository } from './domain/wallet.repository.port';
import { WalletHttpRepository } from './infrastructure/wallet.http-repository';
// [Rutas Web3 · Sprint 7.7]: /wallet, /wallet/:address, /checkout/cripto y /checkout/cripto/:id (lazy) | [Patrón]: Composition Root por funcionalidad (puerto → adaptador) | [Principio]: DIP + Lazy Loading (viem solo se descarga en estas pantallas)
// [Integración]: Next.js reescribe /wallet y /checkout/* hacia este remoto (config/angular.ts · ANGULAR_PREFIXES)

const PROVIDERS: Provider[] = [{ provide: WalletRepository, useClass: WalletHttpRepository }, WalletFacade, CryptoPaymentFacade];
const wallet = () => import('./presentation/pages/wallet.page');
const crypto = () => import('./presentation/pages/crypto-payment.page');

export const WALLET_ROUTES: Routes = [
  {
    path: '',
    providers: PROVIDERS,
    children: [
      { path: '', title: 'Mi billetera · Aula de Idiomas', loadComponent: wallet },
      { path: ':address', title: 'Billetera · Aula de Idiomas', loadComponent: wallet },
    ],
  },
];

export const CRYPTO_ROUTES: Routes = [
  {
    path: '',
    providers: PROVIDERS,
    children: [
      { path: '', title: 'Pago con criptomonedas · Aula de Idiomas', loadComponent: crypto },
      { path: ':id', title: 'Estado del pago cripto · Aula de Idiomas', loadComponent: crypto },
    ],
  },
];
