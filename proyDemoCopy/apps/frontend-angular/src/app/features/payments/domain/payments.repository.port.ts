import type { Observable } from 'rxjs';
import type { CheckoutSession, Order, Payment, Refund } from './models/payments';
// [Puerto PaymentsRepository · Dominio]: órdenes, sesión de pago, historial, estado y reembolsos | [Patrón]: Port (Hexagonal) + Repository | [Principio]: DIP + ISP
// `abstract class` (TS): contrato + token de inyección a la vez

export abstract class PaymentsRepository {
  abstract createOrder(courseIds: string[]): Observable<Order>;
  abstract order(id: string): Observable<Order>;
  abstract cancelOrder(id: string): Observable<Order>;
  abstract createCheckoutSession(orderId: string): Observable<CheckoutSession>;
  abstract myPayments(): Observable<Payment[]>;
  abstract paymentStatus(id: string): Observable<Payment>;
  abstract refund(paymentId: string, amountMinor?: number, reason?: string): Observable<Refund>;
}
