import type { Provider } from '@angular/core';
import type { Routes } from '@angular/router';
import { OrderFacade } from './application/order.facade';
import { PaymentsFacade } from './application/payments.facade';
import { PaymentsRepository } from './domain/payments.repository.port';
import { PaymentsHttpRepository } from './infrastructure/payments.http-repository';
// [Rutas Payments · Sprint 7.4]: /checkout, /checkout/confirmacion/:orderId, /pagos y /pagos/:id (lazy) | [Patrón]: Composition Root por funcionalidad (puerto → adaptador) | [Principio]: DIP + Lazy Loading + OCP
// [Integración]: Next.js reescribe /checkout y /pagos hacia este remoto (config/angular.ts · ANGULAR_PREFIXES)

const PROVIDERS: Provider[] = [{ provide: PaymentsRepository, useClass: PaymentsHttpRepository }, OrderFacade, PaymentsFacade];
const checkout = () => import('./presentation/pages/order-checkout.page');
const history = () => import('./presentation/pages/payments.page');

export const CHECKOUT_ROUTES: Routes = [
  {
    path: '',
    providers: PROVIDERS,
    children: [
      { path: '', title: 'Finalizar compra · Aula de Idiomas', loadComponent: checkout },
      { path: 'confirmacion/:orderId', title: 'Estado del pago · Aula de Idiomas', loadComponent: checkout },
    ],
  },
];

export const PAYMENTS_ROUTES: Routes = [
  {
    path: '',
    providers: PROVIDERS,
    children: [
      { path: '', title: 'Mis pagos · Aula de Idiomas', loadComponent: history },
      { path: ':id', title: 'Detalle del pago · Aula de Idiomas', loadComponent: history },
    ],
  },
];
