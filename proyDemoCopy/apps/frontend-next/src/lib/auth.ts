import { cookies } from "next/headers";
import { apiFetch } from "./api-client";
import { COOKIE_NAMES, Role } from "./constants";
import { refreshOnce } from "./token-refresh";
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

// [TwoFactorChallenge · 2026-11-16]: respuesta de /auth/login cuando el usuario activó el 2FA (sin tokens todavía) | literal `true` (TS) → unión discriminada
export interface TwoFactorChallenge {
  twoFactorRequired: true;
  challengeId: string;
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
  phone?: string; // [2026-10-24]: opcional · `?` (TS) → puede no viajar
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
// [2026-11-16 · 2FA]: si NestJS pide el segundo factor NO hay cookies todavía → se devuelve el reto tal cual | operador `in` (JS): estrecha la unión
export async function login(input: LoginInput): Promise<AuthResponse | TwoFactorChallenge> {
  const res = await apiFetch<AuthResponse | TwoFactorChallenge>("/auth/login", {
    method: "POST",
    body: input,
  });
  if ("twoFactorRequired" in res) return res;
  await setAuthCookies(res);
  return res;
}

// [verifyTwoFactor · 2026-11-16]: canjea reto + código OTP por la sesión y pone las cookies httpOnly | [Patrón]: Facade | [Principio]: DRY (setAuthCookies)
export async function verifyTwoFactor(challengeId: string, code: string): Promise<AuthResponse> {
  const res = await apiFetch<AuthResponse>("/auth/2fa/verify", {
    method: "POST",
    body: { challengeId, code },
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
  try {
    return await renewAccessToken();
  } catch {
    // [Fail-soft]: si el refresh falla (refresh vencido/revocado), devuelve el access actual | [Patrón]: Graceful Degradation
    return (await cookies()).get(COOKIE_NAMES.access)?.value ?? null;
  }
}

// [renewAccessToken · 2026-10-31]: como getFreshAccessToken pero LANZA si el refresh falla → /api/auth/me distingue «sesión terminada» de «backend caído» | [Principio]: SRP
export async function renewAccessToken(): Promise<string | null> {
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

  const res = await refreshOnce<AuthResponse>(refresh); // [Fix 2026-10-31]: refresh de un solo uso → las peticiones simultáneas comparten una rotación (antes la segunda perdía la sesión)
  await setAuthCookies(res);
  return res.accessToken;
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
export async function getCurrentUserPayload(): Promise<UserPayload | null> {
  return userPayloadOf(await getCurrentAccessToken());
}

// `export interface` (TS): datos de sesión que la UI y los guards del BFF leen del JWT | [Principio]: SSOT (antes el tipo estaba repetido en línea)
export interface UserPayload {
  sub: string;
  email: string;
  role: Role;
}

// [userPayloadOf · Fix 2026-10-28]: token → { sub, email, role } o null | [Paradigma]: Funcional (pura) | [Principio]: DRY (getCurrentUserPayload + getFreshUserPayload)
function userPayloadOf(token: string | null): UserPayload | null {
  if (!token) return null;
  const payload = decodeJwtPayload<{ sub?: string; email?: string; role?: Role }>(token);
  if (!payload?.sub || !payload?.email || !payload?.role) return null;
  return { sub: payload.sub, email: payload.email, role: payload.role };
}

// [getFreshUserPayload · Fix 2026-10-28]: como getCurrentUserPayload pero RENOVANDO antes el access token si venció (usa el refresh token)
// [Causa del 401 en POST /api/courses/import]: el `proxy.ts` excluye `/api/*` de su matcher → nadie renovaba la sesión en los Route Handlers;
// la cookie de acceso tiene `maxAge` = TTL del JWT (15 min) → el navegador la BORRA al vencer y `requireAuthor` veía «sin sesión» aunque el refresh siguiera vigente
// [Uso]: SOLO Route Handlers / Server Actions (cookies().set necesita contexto mutable; en un RSC rotaría el refresh sin poder guardarlo) | [Patrón]: Token Refresh + Guard
export async function getFreshUserPayload(): Promise<UserPayload | null> {
  return userPayloadOf(await getFreshAccessToken());
}

// [displayNameFromEmail]: vive en config/navigation.ts (compartido con Angular) | re-export → los imports existentes de @/lib/auth siguen funcionando | [Principio]: DRY
export { displayNameFromEmail } from "@aula/shared-nav/navigation";
