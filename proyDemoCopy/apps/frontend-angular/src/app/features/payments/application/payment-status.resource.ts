import { DestroyRef, effect, inject, resource, type ResourceRef } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PaymentsRepository } from '../domain/payments.repository.port';
import { isFinal, type Payment } from '../domain/models/payments';
// [paymentStatusResource · Aplicación]: estado del pago como `resource()` de Angular con sondeo periódico hasta que deja de estar pendiente | [Patrón]: Resource (estado asíncrono declarativo) + Polling con parada | [Principio]: SRP + DIP | [Paradigma]: Reactivo (signals)
// [Por qué sondeo]: la confirmación real llega por el webhook de Stripe al backend; la pantalla pregunta cada `intervalMs` (el backend además reconcilia con Stripe)
// [Uso]: llamar en contexto de inyección (constructor o inicializador de campo) | `id` null = aún sin pago

export function paymentStatusResource(id: () => string | null, intervalMs = 2000): ResourceRef<Payment | undefined> {
  const repo = inject(PaymentsRepository);
  // `resource` (Angular 22): `params` reactivo → cambia el id = nueva carga; `undefined` = no carga
  const ref = resource({
    params: () => id() ?? undefined,
    loader: ({ params }) => firstValueFrom(repo.paymentStatus(params)),
  });
  let timer: ReturnType<typeof setTimeout> | undefined; // `let`: se reprograma tras cada respuesta
  // `effect` (Angular): tras cada respuesta pendiente programa la siguiente consulta; un estado final la detiene
  effect(() => {
    const payment = ref.hasValue() ? ref.value() : undefined;
    clearTimeout(timer);
    if (payment && !isFinal(payment.status)) timer = setTimeout(() => ref.reload(), intervalMs);
  });
  inject(DestroyRef).onDestroy(() => clearTimeout(timer)); // Salir de la pantalla corta el sondeo
  return ref;
}
