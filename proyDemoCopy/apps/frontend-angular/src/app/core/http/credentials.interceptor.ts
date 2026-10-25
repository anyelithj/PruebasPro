import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_URL } from './api-url.token';
// [credentialsInterceptor · core/http]: añade `withCredentials` a las llamadas a /api/* → la sesión viaja en la cookie httpOnly que puso Next.js | [Patrón]: Interceptor (Chain of Responsibility) | [Principio]: SRP + DRY (ningún repositorio repite la opción) | [Paradigma]: Funcional
// [Seguridad]: solo a la base del BFF → nunca se envían cookies a otros orígenes

// `HttpInterceptorFn` (Angular): interceptor funcional (sin clase); `inject()` funciona porque corre en contexto de inyección
export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  const base = inject(API_URL);
  // `req.clone` (Angular): las peticiones son inmutables → se crea una copia con el cambio
  return next(req.url.startsWith(base) ? req.clone({ withCredentials: true }) : req);
};
