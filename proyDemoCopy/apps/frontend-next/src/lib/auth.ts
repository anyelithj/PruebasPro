import { cookies } from "next/headers";
import { apiFetch } from "./api-client";
import { COOKIE_NAMES, Role } from "./constants";
// [Helpers de auth]: server-side login/logout/me + cookies httpOnly | [Patrón]: Facade | [Principio]: SRP + DRY | [Paradigma]: Funcional + asíncrono

// [Forma de respuesta NestJS]: copia mínima de AuthResponseDto | [Principio]: SSOT
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isEmailVerified: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
  tokenType: "Bearer";
  user: AuthUser;
}

// [Inputs]: equivalentes a DTOs backend
export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

// [Cookie options]: defensa httpOnly + secure (en prod) | [Buena práctica]: anti-XSS
const cookieOptions = (maxAgeSec: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: maxAgeSec,
});

// [setAuthCookies]: guarda par access/refresh en cookies httpOnly | [Principio]: DRY
export async function setAuthCookies(payload: AuthResponse): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAMES.access, payload.accessToken, cookieOptions(payload.accessExpiresIn));
  // [Refresh 7 días]: TTL en segundos
  store.set(COOKIE_NAMES.refresh, payload.refreshToken, cookieOptions(60 * 60 * 24 * 7));
}

// [clearAuthCookies]: idempotente — borra ambas | [Principio]: SRP
export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAMES.access);
  store.delete(COOKIE_NAMES.refresh);
}

// [login]: delega a NestJS, guarda cookies en éxito | [Patrón]: Facade
export async function login(input: LoginInput): Promise<AuthResponse> {
  const res = await apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: input,
  });
  await setAuthCookies(res);
  return res;
}

// [register]: idem login | [Patrón]: Facade
export async function register(input: RegisterInput): Promise<AuthResponse> {
  const res = await apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    body: input,
  });
  await setAuthCookies(res);
  return res;
}

// [logout]: revoca refresh en backend + clear cookies local
export async function logout(): Promise<void> {
  const store = await cookies();
  const refresh = store.get(COOKIE_NAMES.refresh)?.value;
  if (refresh) {
    try {
      await apiFetch<{ success: true }>("/auth/logout", {
        method: "POST",
        body: { refreshToken: refresh },
      });
    } catch {
      // [Tolerante]: si backend caído, igual limpiar cookies local
    }
  }
  await clearAuthCookies();
}

// [getCurrentAccessToken]: lectura síncrona de cookie en RSC/Route Handler
export async function getCurrentAccessToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAMES.access)?.value ?? null;
}

// [getFreshAccessToken]: devuelve un access token válido; si está vencido o por vencer (<60s) usa el refresh token para rotar el par y re-setear cookies | [Patrón]: Token Refresh + Fail-soft | [Principio]: SRP
// [Uso]: SOLO en Route Handlers / Server Actions (cookies().set requiere contexto mutable). En RSC el set se ignora silenciosamente.
export async function getFreshAccessToken(): Promise<string | null> {
  const store = await cookies();
  const access = store.get(COOKIE_NAMES.access)?.value ?? null;

  // [Margen de seguridad]: refresca si faltan <60s o ya no existe el access | [Patrón]: Proactive Refresh
  if (access) {
    const payload = decodeJwtPayload<{ exp?: number }>(access);
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload?.exp && payload.exp - nowSec > 60) {
      return access;
    }
  }

  const refresh = store.get(COOKIE_NAMES.refresh)?.value;
  if (!refresh) return access; // [Sin refresh]: devuelve lo que haya (puede ser null → 401 aguas abajo)

  try {
    const res = await apiFetch<AuthResponse>("/auth/refresh", {
      method: "POST",
      body: { refreshToken: refresh },
    });
    await setAuthCookies(res);
    return res.accessToken;
  } catch {
    // [Fail-soft]: si el refresh falla (refresh vencido/revocado), devuelve el access actual | [Patrón]: Graceful Degradation
    return access;
  }
}

// [decodeJwtPayload]: extrae payload SIN verificar firma. Solo para routing UX
// (autenticación real ocurre en backend; no fiable para autorización)
function decodeJwtPayload<T = Record<string, unknown>>(token: string): T | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const padded = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

// [getCurrentUserRole]: lee role del access token. null si no autenticado
export async function getCurrentUserRole(): Promise<Role | null> {
  const token = await getCurrentAccessToken();
  if (!token) return null;
  const payload = decodeJwtPayload<{ role?: Role }>(token);
  return payload?.role ?? null;
}

// [getCurrentUserPayload]: lee sub/email/role del JWT — solo lectura UX, no autorización | [Principio]: SRP
export async function getCurrentUserPayload(): Promise<{
  sub: string;
  email: string;
  role: Role;
} | null> {
  const token = await getCurrentAccessToken();
  if (!token) return null;
  const payload = decodeJwtPayload<{ sub?: string; email?: string; role?: Role }>(token);
  if (!payload?.sub || !payload?.email || !payload?.role) return null;
  return { sub: payload.sub, email: payload.email, role: payload.role };
}

// [displayNameFromEmail]: vive en config/navigation.ts (compartido con Angular) | re-export → los imports existentes de @/lib/auth siguen funcionando | [Principio]: DRY
export { displayNameFromEmail } from "@aula/shared-nav/navigation";
