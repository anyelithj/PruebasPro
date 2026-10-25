// session.ts (Nitro server utils, auto-importado en server/) => cookies de sesión del panel creadas por el SSO con
// Next.js (server/middleware/auth.ts). Patrón Facade: el middleware no sabe cómo se guardan ni se borran las cookies.
import type { H3Event } from "h3";
import { AUTH_COOKIES, REFRESH_MAX_AGE, cookieOptions, type RoleName, type SessionUser } from "~~/shared/lib/auth-config";

const EXPIRY_MARGIN_SECONDS = 60; // Igual que Next: se pide token nuevo 1 min antes de que venza

// secondsUntilExpiry => vida restante del JWT de Express (claim "exp"); la cookie muere con el token
function secondsUntilExpiry(token: string): number {
  try {
    const { exp } = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString()) as { exp?: number };
    return Math.max(EXPIRY_MARGIN_SECONDS, (exp ?? 0) - Math.floor(Date.now() / 1000) - EXPIRY_MARGIN_SECONDS);
  } catch {
    return EXPIRY_MARGIN_SECONDS;
  }
}

// setRequestCookies => la cookie nueva (o borrada) aplica en ESTE mismo render (useCookie lee la petición, no la respuesta)
function setRequestCookies(event: H3Event, values: Record<string, string | null>): void {
  const kept = (event.node.req.headers.cookie ?? "").split(/;\s*/).filter((pair) => pair && !((pair.split("=")[0] ?? "") in values));
  const added = Object.entries(values).flatMap(([name, value]) => (value === null ? [] : [`${name}=${encodeURIComponent(value)}`]));
  event.node.req.headers.cookie = [...kept, ...added].join("; ");
}

// saveSsoSession => access token (vida del JWT) + datos mínimos del usuario (sin datos sensibles) para la UI
export function saveSsoSession(event: H3Event, accessToken: string, nextUser: { id: string; email: string; name: string; roles: RoleName[] }): void {
  const [firstName = "", ...rest] = nextUser.name.split(" ");
  const user: SessionUser = { id: nextUser.id, email: nextUser.email, firstName, lastName: rest.join(" "), roles: nextUser.roles };
  const userJson = JSON.stringify(user);
  setCookie(event, AUTH_COOKIES.access, accessToken, cookieOptions(secondsUntilExpiry(accessToken)));
  setCookie(event, AUTH_COOKIES.user, userJson, cookieOptions(REFRESH_MAX_AGE));
  setRequestCookies(event, { [AUTH_COOKIES.access]: accessToken, [AUTH_COOKIES.user]: userJson });
}

// clearAuthSession => borra la sesión de Nuxt (cerró sesión en Next)
export function clearAuthSession(event: H3Event): void {
  for (const name of Object.values(AUTH_COOKIES)) deleteCookie(event, name, { path: "/" });
  setRequestCookies(event, { [AUTH_COOKIES.access]: null, [AUTH_COOKIES.user]: null });
}
