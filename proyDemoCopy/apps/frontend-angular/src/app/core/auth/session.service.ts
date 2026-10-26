import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import * as z from 'zod'; // [Tree-shaking · Zod 4]: import de namespace (`* as z`) → esbuild empaqueta solo las funciones usadas (con `{ z }` arrastraba Zod entero, ~450 kB)
import { ROLES, type Role } from '@aula/shared-schemas';
import { displayNameFromEmail, toPortalRole } from '@aula/shared-nav/navigation'; // [SSOT]: mismo nombre visible y rol de UI que el shell Next.js
import { API_URL } from '../http/api-url.token';
// [SessionService · core/auth]: sesión compartida con el shell de Next.js (cookie httpOnly → GET /api/auth/me) expuesta como signals | [Patrón]: Singleton (root) + State (anonymous/loading/ready) + Memoization (una sola petición) | [Principio]: SRP + DIP | [Paradigma]: Reactivo (signals)
// [Nota]: la matriz nombra /api/auth/session; el BFF real de Next.js expone /api/auth/me (nombres del código)

// [Roles]: los del backend (Role enum de NestJS) | `z.enum` (Zod) valida y tipa a la vez
export { ROLES, type Role }; // [Sprint 7.1]: roles compartidos con Next.js (packages/shared-schemas)

// [Esquema]: solo lo que la UI usa; `passthrough` no es necesario → Zod descarta lo demás | [Seguridad]: validar lo que llega del servidor
const SessionUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.enum(ROLES),
  firstName: z.string().nullish(),
});
export type SessionUser = z.infer<typeof SessionUserSchema>; // `z.infer` (Zod): tipo derivado del esquema (DRY)

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private loading?: Promise<SessionUser | null>; // [Memo]: guards y componentes comparten la misma petición

  // `signal` (Angular): estado privado escribible; se expone solo lectura
  private readonly _user = signal<SessionUser | null>(null);
  readonly user = this._user.asReadonly();
  // `computed` (Angular): derivados memoizados que se recalculan solo cuando cambia `user`
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly role = computed(() => this._user()?.role ?? null);
  // [displayName]: igual que el layout de Next.js (deriva del email) → el usuario ve el mismo nombre en las dos aplicaciones
  readonly displayName = computed(() => displayNameFromEmail(this._user()?.email ?? ''));
  // [portalRole]: USER/TEACHER/ADMIN → estudiante/docente/admin (elige los ítems del sidebar compartido)
  readonly portalRole = computed(() => toPortalRole(this.role()));

  // [load]: idempotente; 401 o respuesta inválida → anónimo (el guard redirige al login del shell)
  load(): Promise<SessionUser | null> {
    this.loading ??= firstValueFrom(this.http.get<{ user: unknown }>(`${this.api}/auth/me`))
      .then((res) => SessionUserSchema.parse(res.user))
      .catch(() => null)
      .then((user) => {
        this._user.set(user);
        return user;
      });
    return this.loading;
  }

  // [hasRole]: ¿el usuario tiene alguno de los roles? | [Patrón]: Policy
  hasRole(...roles: Role[]): boolean {
    const r = this._user()?.role;
    return !!r && roles.includes(r);
  }

  // [logout]: mismo flujo que LogoutButton de Next.js → POST /api/auth/logout (borra la cookie httpOnly) y siempre al login | `finally` (ES2018)
  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${this.api}/auth/logout`, {}));
    } catch {
      // Sin red o sesión ya vencida: igual se sale
    } finally {
      location.assign('/login');
    }
  }

  // [onSessionExpired · Sprint 7.13]: un 401 solo cierra la sesión de quien la TENÍA → el visitante de una pantalla pública (/ayuda/faq, /verificar) no es enviado al login | [Principio]: DRY (lo usan la app y los Angular Elements)
  onSessionExpired(): void {
    if (this.isAuthenticated()) this.redirectToLogin();
  }

  // [redirectToLogin]: el login vive en Next.js → navegación completa con `from` (mismo parámetro que usa proxy.ts) | `location.assign` (DOM)
  redirectToLogin(): void {
    location.assign(`/login?from=${encodeURIComponent(location.pathname + location.search)}`);
  }
}
