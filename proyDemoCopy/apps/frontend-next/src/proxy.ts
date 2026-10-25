import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAMES, PORTAL_PREFIXES } from "./lib/constants";
import { apiFetch } from "./lib/api-client"; // [Facade HTTP]: fetch nativo → válido en el runtime del proxy
// [Proxy Next.js 16]: protege rutas (portal)/* y redirige auth si ya hay sesión | [Patrón]: Chain of Responsibility | [Principio]: SRP | [Paradigma]: Funcional + AOP
// [Nota]: en Next.js 16 el archivo `middleware.ts` fue deprecado y renombrado a `proxy.ts`.

// [Rutas portal]: requieren sesión (PORTAL_PREFIXES viene de lib/constants). Sin access cookie → /login

// [Rutas auth]: si ya hay sesión → /dashboard (evita login si ya autenticado)
const AUTH_PREFIXES = ["/login", "/register"];

// [hasValidSession]: el token debe decodificar y no estar vencido. Firma se valida en backend.
// [Por qué]: verificar solo presencia causaba loop /dashboard ⇄ /login con token inválido/expirado
// (dashboard ve role null → /login; proxy veía cookie → /dashboard, infinitamente).
function hasValidSession(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const part = token.split(".")[1];
    if (!part) return false;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

// [Respuesta mínima de /auth/refresh]: solo lo que el proxy necesita | `interface` (TS): se borra al compilar
interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number; // Segundos
}

// [Opciones de cookie]: mismas que lib/auth.ts (httpOnly + secure en prod + SameSite=Lax) | [Seguridad]: anti-XSS
const cookieOptions = (maxAge: number) => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge });

// [tryRefresh]: rota el par de tokens con el refresh token | [Patrón]: Token Refresh + Fail-soft (null → se redirige a /login como antes)
async function tryRefresh(refreshToken: string): Promise<RefreshResponse | null> {
  try {
    return await apiFetch<RefreshResponse>("/auth/refresh", { method: "POST", body: { refreshToken } });
  } catch {
    return null; // Refresh vencido o revocado
  }
}

// `async function` (ES2017): el proxy puede esperar la renovación del token antes de decidir
export async function proxy(request: NextRequest): Promise<NextResponse | undefined> {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get(COOKIE_NAMES.access)?.value;
  const refreshToken = request.cookies.get(COOKIE_NAMES.refresh)?.value;
  const hasSession = hasValidSession(accessToken);
  const isPortal = PORTAL_PREFIXES.some((p) => pathname.startsWith(p));

  // [Renovación silenciosa]: access vencido (15 min) + refresh vigente → se renueva y la petición continúa.
  // [Fix]: antes el proxy redirigía a /login también los POST de Server Actions (p. ej. "Crear curso" tras rellenar el formulario
  // más de 15 min) y Next.js mostraba "An unexpected response was received from the server".
  if (isPortal && !hasSession && refreshToken) {
    const fresh = await tryRefresh(refreshToken);
    if (fresh) {
      // [Cookie reescrita en la PETICIÓN]: los Server Components/Actions de esta misma petición ya leen el token nuevo
      request.cookies.set(COOKIE_NAMES.access, fresh.accessToken);
      request.cookies.set(COOKIE_NAMES.refresh, fresh.refreshToken);
      const res = NextResponse.next({ request: { headers: request.headers } });
      // [Cookie en la RESPUESTA]: el navegador guarda el par nuevo para las siguientes peticiones
      res.cookies.set(COOKIE_NAMES.access, fresh.accessToken, cookieOptions(fresh.accessExpiresIn));
      res.cookies.set(COOKIE_NAMES.refresh, fresh.refreshToken, cookieOptions(60 * 60 * 24 * 7));
      return res;
    }
  }

  // [Portal sin sesión → /login]: append `?from=…` para volver tras login
  if (isPortal && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    const res = NextResponse.redirect(loginUrl);
    // [Limpieza]: cookie presente pero inválida/expirada → borrar para evitar estados zombis
    // [Carrera de refresh]: si había refresh token NO se borra: otra petición paralela pudo haber rotado ya el par y borrarlo cerraría esa sesión recién renovada
    if (accessToken && !refreshToken) {
      res.cookies.delete(COOKIE_NAMES.access);
      res.cookies.delete(COOKIE_NAMES.refresh);
    }
    return res;
  }

  // [Auth con sesión → /dashboard]: evita doble-login UX
  if (AUTH_PREFIXES.some((p) => pathname.startsWith(p)) && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // [Sin match → continuar normal]: NextResponse.next() implícito al no retornar
  return undefined;
}

// [Matcher]: excluye assets, api, _next | [Buena práctica]: no procesar requests estáticos
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|_next/webpack-hmr|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js|map)$).*)",
  ],
};
