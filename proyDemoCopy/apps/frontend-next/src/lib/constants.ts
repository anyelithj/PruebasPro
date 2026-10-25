import { CATEGORIES, categoryLabel } from "@/lib/categories";
import type { Difficulty } from "@/types/quiz";
import { ANGULAR_PREFIXES } from "@/config/angular"; // [Remoto Angular]: sus pantallas también exigen sesión
// [Constantes globales]: rutas, cookies, tokens | [Patrón]: Constants Module | [Principio]: SSOT | [Paradigma]: Funcional

// [Rutas del portal]: las protegidas por proxy
export const PORTAL_ROUTES = {
  dashboard: "/dashboard",
  quiz: "/quiz",
  leaderboard: "/leaderboard",
  profile: "/profile",
  assistant: "/assistant",
  courses: "/courses",
} as const;

// [Prefijos protegidos]: lista única que consumen proxy.ts y auth.config.ts | [Principio]: SSOT + DRY
// `export const` (ES2015): valor inmutable exportado del módulo | `as const` (TS): congela el array como tupla readonly de literales
export const PORTAL_PREFIXES = [
  "/dashboard",
  "/quiz",
  "/leaderboard",
  "/profile",
  "/assistant",
  "/feedback",
  "/teacher",
  "/admin",
  "/resources", // [Recursos]: material de estudio publicado (requiere sesión)
  "/actividades", // [2026-10-23]: Actividades con pestañas (sustituye al desplegable del menú)
  "/courses", // [Fix]: /courses no estaba protegido → sin sesión el SSR fallaba en vez de redirigir a /login
  ...ANGULAR_PREFIXES, // [Angular 22]: /tutor, /redaccion, /estudio, /notificaciones, /reportes (rewrites hacia :9100)
] as const;

// [Rutas auth]: públicas
export const AUTH_ROUTES = {
  login: "/login",
  register: "/register",
  terms: "/terms",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  verifyEmail: "/verify-email",
} as const;

// [Cookies httpOnly]: nombres centralizados | [Principio]: DRY
export const COOKIE_NAMES = {
  access: process.env.ACCESS_TOKEN_COOKIE ?? "neuroedu_access",
  refresh: process.env.REFRESH_TOKEN_COOKIE ?? "neuroedu_refresh",
} as const;

// [Backend URLs]: server-side only (sin NEXT_PUBLIC_)
export const BACKEND = {
  url: process.env.BACKEND_URL ?? "http://localhost:4000",
  prefix: process.env.API_PREFIX ?? "api/v1",
};

// [Helper URL]: arma endpoint absoluto | [Principio]: DRY
export const apiUrl = (path: string): string =>
  `${BACKEND.url}/${BACKEND.prefix}${path.startsWith("/") ? path : `/${path}`}`;

// [Roles]: deben coincidir con backend (Role enum NestJS)
export enum Role {
  USER = "USER",
  TEACHER = "TEACHER",
  ADMIN = "ADMIN",
}

// [Niveles MCER/CEFR]: A1 → C2 en orden | `as const` (TS): tupla de literales inmutable → sirve para z.enum y para .map() | [Principio]: SSOT + DRY
export { CEFR_LEVELS } from "@aula/shared-schemas"; // [Sprint 7.1]: valor compartido con Angular (packages/shared-schemas)

// [Etiquetas español + banda MCER/CEFR]: A = usuario básico, B = independiente, C = competente.
// Alineado con DIFFICULTY_CEFR_BAND del backend | [Principio]: SSOT + DRY
export const DIFFICULTY_LABEL_ES: Readonly<Record<Difficulty, string>> = Object.freeze({
  easy: "Básico (A1–A2)",
  medium: "Intermedio (B1–B2)",
  hard: "Avanzado (C1–C2)",
});

// [Opciones para selects de formularios]: derivadas del SSOT | [Principio]: DRY
export const DIFFICULTY_OPTIONS: ReadonlyArray<{ value: Difficulty; label: string }> =
  (Object.keys(DIFFICULTY_LABEL_ES) as Difficulty[]).map((value) => ({
    value,
    label: DIFFICULTY_LABEL_ES[value],
  }));

// [Etiquetas categorías]: derivadas del SSOT de categorías para no duplicar el catálogo | [Principio]: DRY + SSOT
export const CATEGORY_LABEL_ES: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label])),
);

// [Helpers]: lookup con fallback al valor crudo | [Principio]: DRY
export const labelDifficulty = (k?: string): string =>
  k ? (DIFFICULTY_LABEL_ES[k as Difficulty] ?? k) : "—";

export const labelCategory = (k?: string): string => categoryLabel(k);

// [Cookie del sidebar]: «1» = oculto en escritorio | definida en config/navigation.ts (la lee también el shell Angular) | re-export para los imports existentes | [Principio]: DRY
export { SIDEBAR_COOKIE } from "@aula/shared-nav/navigation";
