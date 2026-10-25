import { HttpResponse, type HttpInterceptorFn } from '@angular/common/http';
import { map } from 'rxjs';
// [envelopeInterceptor · core/http]: desenvuelve `{ statusCode, data, meta }` del TransformInterceptor de NestJS (la ruta comodín del BFF lo deja pasar tal cual) | [Patrón]: Interceptor + Adapter | [Principio]: DRY (ningún repositorio repite `.data`) + SRP | [Paradigma]: Funcional + Reactivo
// Misma regla que `apiFetch` de Next.js: si no hay envelope, el cuerpo pasa sin cambios

// [isEnvelope]: type guard (TS) — objeto con `statusCode` numérico y clave `data`
const isEnvelope = (body: unknown): body is { data: unknown } =>
  typeof body === 'object' && body !== null && 'data' in body && typeof (body as { statusCode?: unknown }).statusCode === 'number';

export const envelopeInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    // `HttpResponse.clone({ body })` (Angular): las respuestas son inmutables
    map((event) => (event instanceof HttpResponse && isEnvelope(event.body) ? event.clone({ body: event.body.data }) : event)),
  );
