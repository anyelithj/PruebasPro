// auth.ts (Nitro server middleware) => SSO con Next.js: el login es ÚNICO y vive en la tienda (next-auth).
// En cada petición de PÁGINA: si el navegador trae la cookie de next-auth (mismo dominio tras Nginx; en desarrollo
// localhost comparte cookies entre puertos) y Nuxt aún no tiene access token, Nitro pide la sesión a Next
// (/api/auth/session) y guarda access token + usuario en las cookies de Nuxt. Los Set-Cookie de Next se reenvían:
// si Next rotó el refresh token de Express, el navegador recibe la cookie nueva (si no, la sesión de Next se rompería).
// Sin cookie de next-auth (cerró sesión en Next) => se borra la sesión de Nuxt. Express valida el JWT en cada petición.
import type { H3Event } from "h3";
import { AUTH_COOKIES, type RoleName } from "~~/shared/lib/auth-config";

// Solo navegación de páginas: assets, /_nuxt, /api y el Service Worker no necesitan sesión (menos llamadas)
const SKIP = /^(\/cms)?\/(_nuxt|api|__nuxt|_ipx|sw\.js|workbox-|manifest|favicon)/;
// next-auth v5: "authjs.session-token" (http) o "__Secure-authjs.session-token" (https); ".0/.1" si va en trozos
const NEXT_SESSION_COOKIE = /(?:^|;\s*)(?:__Secure-)?authjs\.session-token/;

// NextSession => forma del callback "session" de next-auth en ecommerce-next (shared/lib/auth-config.ts)
interface NextSession {
  accessToken?: string;
  error?: string;
  user?: { id: string; email: string; name: string; roles: RoleName[] };
}

// fetchNextSession => sesión VÁLIDA de next-auth reenviando las cookies del navegador; null si no hay o Next no responde
// (la página se sirve sin sesión: las públicas no la necesitan y las privadas llevan al login)
async function fetchNextSession(event: H3Event, cookie: string): Promise<{ accessToken: string; user: NonNullable<NextSession["user"]> } | null> {
  try {
    const response = await $fetch.raw<NextSession | null>("/api/auth/session", { baseURL: useRuntimeConfig().storefrontInternalUrl, headers: { cookie } });
    for (const header of response.headers.getSetCookie()) appendResponseHeader(event, "set-cookie", header);
    const session = response._data;
    return session?.accessToken && session.user && !session.error ? { accessToken: session.accessToken, user: session.user } : null;
  } catch {
    return null;
  }
}

export default defineEventHandler(async (event) => {
  if (event.method !== "GET" || SKIP.test(event.path)) return;
  const cookie = getRequestHeader(event, "cookie") ?? "";
  if (!NEXT_SESSION_COOKIE.test(cookie)) {
    if (getCookie(event, AUTH_COOKIES.user)) clearAuthSession(event);
    return;
  }
  if (getCookie(event, AUTH_COOKIES.access)) return; // Token vigente: nada que hacer
  const session = await fetchNextSession(event, cookie);
  if (session) saveSsoSession(event, session.accessToken, session.user);
});
