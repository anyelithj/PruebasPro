// auth-config.ts => configuración única de autenticación (Singleton de constantes): nombres de cookies, duración y
// roles con acceso al panel. La sesión es la MISMA de Express (JWT): Nuxt no tiene usuarios ni login propios.
// SSO: el login vive en Next.js; Nitro copia el access token de la sesión de next-auth (server/middleware/auth.ts).
// El refresh token se queda en la cookie cifrada de next-auth: Nuxt solo ve el access token de vida corta.
export const AUTH_COOKIES = {
  access: "nuxt_access", // Legible por JS (Authorization: Bearer); expira con el token (15 min)
  user: "nuxt_user", // Datos mínimos del usuario (id, nombre, roles) para la UI
} as const;

export const REFRESH_MAX_AGE = 7 * 24 * 60 * 60; // 7 días (igual que la sesión de Express)

// Roles del sistema (mismos nombres que roles.constants.ts de Express)
export const ROLES = ["ADMIN", "VENDOR", "CUSTOMER"] as const;
export type RoleName = (typeof ROLES)[number];
export const PANEL_ROLES: RoleName[] = ["ADMIN", "VENDOR"]; // Hoja "ADMIN+VENDOR": quienes entran al panel Nuxt

// SessionUser => lo que la UI necesita del usuario (sin datos sensibles)
export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: RoleName[];
}

// cookieOptions => flags seguras por defecto: SameSite=Lax (protege de CSRF) y Secure en producción
export const cookieOptions = (maxAge: number, httpOnly = false) => ({ maxAge, httpOnly, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" });
