import type { HttpInterceptorFn } from '@angular/common/http';
import { computed, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { NOT_CRUD } from './notify.interceptor';
// [busyInterceptor · core/http · 2026-11-16]: mientras haya un alta, edición o borrado en curso → indicador global «Cargando… puede tardar unos minutos» (BusyOverlayComponent)
// Mismo criterio que notifyInterceptor (GET y NOT_CRUD fuera: el lector, la IA, el juego… siguen sin bloquear la pantalla) | [Patrón]: Interceptor (AOP) + estado global con signal | [Principio]: DRY + OCP (formularios nuevos sin código extra)
// ponytail: contador de módulo (signal) en vez de servicio — un solo valor de solo lectura para la vista

const inFlight = signal(0); // `signal` (Angular): contador reactivo de peticiones de escritura en curso
export const busy = computed(() => inFlight() > 0); // Solo lectura para la vista

export const busyInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || NOT_CRUD.test(req.url)) return next(req);
  inFlight.update((n) => n + 1);
  // `finalize` (RxJS): baja el contador al terminar, fallar o cancelarse → nunca queda colgado
  return next(req).pipe(finalize(() => inFlight.update((n) => Math.max(0, n - 1))));
};
