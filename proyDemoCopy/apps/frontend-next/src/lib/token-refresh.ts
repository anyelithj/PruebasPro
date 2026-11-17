import { apiFetch } from "./api-client";
import { ApiError } from "./errors";
// [refreshOnce · 2026-10-31]: UNA sola renovación por refresh token, aunque lleguen varias peticiones a la vez | [Patrón]: Single Flight + caché corta | [Principio]: DRY (proxy.ts y lib/auth.ts) + SRP | [Paradigma]: Funcional + asíncrono
// [Causa que corrige]: NestJS rota el refresh (un solo uso) → con dos peticiones simultáneas al vencer el access, la segunda recibía «Session not active», se quedaba sin token y el 401 mandaba al login cada 15 min con la sesión aún viva
// ponytail: memoria de un solo proceso; con varias instancias de Next hace falta un candado compartido (Redis) o tolerancia de reuso en NestJS

export interface RefreshedTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number; // Segundos
}

// [Fix 2026-10-31]: 30 s → 5 min. Si el navegador cancela la petición que rotó (prefetch, cambio de pantalla) nunca recibe las cookies nuevas y su refresh viejo ya está revocado: 30 s no alcanzaban y la sesión moría con 7 días de vigencia
// [Seguridad]: ventana de reuso acotada, misma idea que el «leeway» de rotación de los proveedores OAuth | Una petición con la cookie vieja recibe el mismo par
const GRACE_MS = 5 * 60_000;

// [isRefreshRefused · 2026-10-31]: ¿NestJS rechazó el refresh (sesión terminada de verdad)? | Backend caído, 5xx, 408 o 429 NO cierran la sesión: es pasajero | [Paradigma]: Funcional (pura) | [Principio]: DRY (proxy.ts y /api/auth/me)
export const isRefreshRefused = (err: unknown): boolean =>
  err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429;

// `globalThis` (ES2020): en desarrollo cada Route Handler se empaqueta aparte → un Map de módulo no se compartiría entre ellos
const store = globalThis as typeof globalThis & { __aulaRefreshes?: Map<string, Promise<RefreshedTokens>> };
const pending = (store.__aulaRefreshes ??= new Map());

// [refreshOnce]: rechaza si el refresh venció o fue revocado; un fallo no se recuerda (la siguiente petición reintenta)
export function refreshOnce<T extends RefreshedTokens = RefreshedTokens>(refreshToken: string): Promise<T> {
  const running = pending.get(refreshToken);
  if (running) return running as Promise<T>;
  const call = apiFetch<T>("/auth/refresh", { method: "POST", body: { refreshToken } });
  pending.set(refreshToken, call);
  // `.then(ok, fail)`: limpia en ambos casos sin crear una promesa rechazada sin manejar | `unref` (Node.js): el temporizador no retiene el proceso
  void call.then(
    () => (setTimeout(() => pending.delete(refreshToken), GRACE_MS) as { unref?: () => void }).unref?.(),
    () => pending.delete(refreshToken),
  );
  return call;
}
