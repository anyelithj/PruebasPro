import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { z } from 'zod';
import { API_URL } from '@core/http/api-url.token';
import { PaymentsRepository } from '../domain/payments.repository.port';
import {
  CheckoutSessionSchema,
  OrderSchema,
  PaymentSchema,
  RefundSchema,
  type CheckoutSession,
  type Order,
  type Payment,
  type Refund,
} from '../domain/models/payments';
// [PaymentsHttpRepository · Infraestructura]: HttpClient hacia /api/payments/* (BFF de Next.js → NestJS) | [Patrón]: Adapter + Repository | [Principio]: SRP (único lugar con HTTP) + DIP | [Paradigma]: Reactivo (RxJS)
// [Seguridad]: precios y totales los calcula el backend; aquí solo se envían ids y se valida la forma de la respuesta con Zod

@Injectable()
export class PaymentsHttpRepository extends PaymentsRepository {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_URL)}/payments`;
  private readonly id = (v: string) => encodeURIComponent(v); // [Seguridad]: ids siempre codificados en la URL

  createOrder(courseIds: string[]): Observable<Order> {
    return this.http.post<unknown>(`${this.base}/orders`, { courseIds }).pipe(map((r) => OrderSchema.parse(r)));
  }

  order(id: string): Observable<Order> {
    return this.http.get<unknown>(`${this.base}/orders/${this.id(id)}`).pipe(map((r) => OrderSchema.parse(r)));
  }

  cancelOrder(id: string): Observable<Order> {
    return this.http.patch<unknown>(`${this.base}/orders/${this.id(id)}/cancel`, {}).pipe(map((r) => OrderSchema.parse(r)));
  }

  createCheckoutSession(orderId: string): Observable<CheckoutSession> {
    return this.http.post<unknown>(`${this.base}/checkout-session`, { orderId }).pipe(map((r) => CheckoutSessionSchema.parse(r)));
  }

  myPayments(): Observable<Payment[]> {
    return this.http.get<unknown>(`${this.base}/me`).pipe(map((r) => z.array(PaymentSchema).parse(r)));
  }

  paymentStatus(id: string): Observable<Payment> {
    return this.http.get<unknown>(`${this.base}/${this.id(id)}/status`).pipe(map((r) => PaymentSchema.parse(r)));
  }

  // Spread condicional: sin monto = reembolso de lo que queda (el DTO lo trata como opcional)
  refund(paymentId: string, amountMinor?: number, reason?: string): Observable<Refund> {
    return this.http
      .post<unknown>(`${this.base}/${this.id(paymentId)}/refund`, { ...(amountMinor ? { amountMinor } : {}), ...(reason ? { reason } : {}) })
      .pipe(map((r) => RefundSchema.parse(r)));
  }
}
