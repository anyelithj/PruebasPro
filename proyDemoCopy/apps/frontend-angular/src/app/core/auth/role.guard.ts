import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { SessionService, type Role } from './session.service';
// [roleGuard · core/auth]: guard funcional por rol para las rutas lazy | [Patrón]: Guard (Chain of Responsibility del router) + Factory (devuelve un guard configurado) | [Principio]: SRP + OCP (rol nuevo = argumento nuevo) | [Paradigma]: Funcional
// [Seguridad]: es UX, no seguridad — NestJS vuelve a validar JWT y rol en cada endpoint
// Sin sesión → login de Next.js · sin rol → panel de Next.js (no hay pantalla 403 propia)

// `(...roles: Role[]) => CanActivateFn` (TS): sin roles = cualquier usuario autenticado
export const roleGuard =
  (...roles: Role[]): CanActivateFn =>
  async () => {
    const session = inject(SessionService);
    const user = await session.load();
    if (!user) {
      session.redirectToLogin();
      return false;
    }
    if (roles.length && !session.hasRole(...roles)) {
      location.assign('/dashboard'); // Navegación completa: el panel es del shell Next.js
      return false;
    }
    return true;
  };
