import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AulaEventsService } from '../events/aula-events.service';
// [errorInterceptor · core/http]: traduce los errores HTTP a un `ApiError` legible y avisa al shell de Next.js si la sesión caducó | [Patrón]: Interceptor + Adapter (HttpErrorResponse → ApiError) | [Principio]: SRP + DRY | [Paradigma]: Funcional + Reactivo (RxJS)

// `class ApiError extends Error` (TS/ES2015): error de dominio con el status → las fachadas muestran `message` sin conocer HTTP
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string, // [2026-10-25]: código estable del backend (p. ej. SPEECH_ENGINE_MISSING) → la fachada elige el respaldo sin leer el texto
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// [Mensajes por defecto]: cuando el backend no envía `message` | `Record<number, string>` (TS)
const DEFAULT_MESSAGES: Record<number, string> = {
  0: 'Sin conexión con el servidor.',
  401: 'Tu sesión terminó. Vuelve a iniciar sesión.',
  403: 'No tienes permiso para esta acción.',
  404: 'No encontrado.',
  409: 'Todavía no está listo.',
};

// [parseBody]: con `responseType: 'text'` (streaming del tutor) el error llega como texto JSON → se intenta parsear
type ErrorBody = { message?: string | string[]; code?: unknown };
function parseBody(raw: unknown): ErrorBody | null {
  if (typeof raw !== 'string') return raw as ErrorBody | null;
  try {
    return JSON.parse(raw) as ErrorBody;
  } catch {
    return null;
  }
}

// [messageOf]: texto del backend (string o lista de class-validator) o uno genérico | [Paradigma]: Funcional (pura)
export function messageOf(err: HttpErrorResponse): string {
  const body = parseBody(err.error);
  const raw = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
  return raw || DEFAULT_MESSAGES[err.status] || (err.status >= 500 ? 'Error del servidor. Inténtalo más tarde.' : 'Ocurrió un error.');
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const events = inject(AulaEventsService);
  // `catchError` (RxJS): intercepta el error del flujo y lo re-lanza ya traducido
  return next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) return throwError(() => err);
      if (err.status === 401) events.publish('session-expired', { url: location.pathname }); // [Shell]: Next.js decide (login)
      const code = parseBody(err.error)?.code;
      return throwError(() => new ApiError(err.status, messageOf(err), typeof code === 'string' ? code : undefined));
    }),
  );
};
