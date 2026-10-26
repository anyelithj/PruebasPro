import type { Dictionary } from "../shared-i18n"; // `import type` (TS): solo tipos, se borra al compilar → este archivo sigue sin dependencias en runtime
// [Navegación del portal como configuración]: ítems del sidebar por rol, rol de UI, avatar y estado del menú — SSOT de Next.js Y de Angular | [Patrón]: Configuration Object + SSOT | [Principio]: DRY (un solo menú para los dos frontends) + OCP (ítem nuevo = una línea) | [Paradigma]: Declarativo + Funcional (funciones puras)
// [@aula/shared-nav · Sprint 7.1]: paquete del monorepo (packages/shared-nav) · [Tecnología]: TypeScript puro sin imports de runtime → lo importan components/portal/* (Next.js) y apps/frontend-angular por el alias @aula/* | [UX]: el usuario ve el MISMO sidebar en las pantallas de Next.js y de Angular

// `export type` (TS union literal): los tres roles visibles del portal
export type PortalRole = "estudiante" | "docente" | "admin";

// [NavIcon]: nombres lucide (kebab-case) → Next.js los mapea a lucide-react y Angular a su IconComponent | `as const` evita strings libres
export type NavIcon =
  | "layout-grid"
  | "file-text"
  | "message-square"
  | "trending-up"
  | "users"
  | "chart-column"
  | "graduation-cap"
  | "library"
  | "user-round"
  | "notebook-text"
  | "sparkles"
  | "pen-line"
  | "clipboard-list"
  | "circle-help"
  | "award"
  | "gamepad-2" // [Sprint 8.8]: Juegos
  | "puzzle" // [Sprint 8.14]: Práctica interactiva
  | "languages" // [Sprint 8.3]: Vocabulario y traductor
  | "music" // [Sprint 9.8]: Música
  | "messages-square" // [Sprint 9.11]: Diálogos
  | "globe" // [Sprint 10.7]: Poliglota
  | "book-open"; // [Sprint 10.11]: Gramática

// `keyof Dictionary["nav"]` (TS): la etiqueta es una CLAVE del diccionario → imposible escribir una traducción inexistente | [Tipado seguro]
// `also` = prefijos extra que marcan el ítem como activo (Gestión agrupa varias rutas)
// `hard` = pantalla del remoto Angular → en Next.js <a> con navegación completa (rewrite) · en Angular routerLink (navegación interna)
export interface NavItem {
  readonly href: string;
  readonly labelKey: keyof Dictionary["nav"];
  readonly icon: NavIcon;
  readonly also?: readonly string[];
  readonly hard?: true;
  readonly group?: NavGroupKey; // [2026-10-19]: ítems que se muestran juntos en un desplegable del menú
}

// [Grupos del menú · 2026-10-19]: «Actividades» reúne Juegos, Práctica, Música, Diálogos y Poliglota (zona para practicar) → menú más corto y ordenado
export type NavGroupKey = "activities";
export interface NavGroup {
  readonly group: NavGroupKey;
  readonly labelKey: keyof Dictionary["nav"];
  readonly icon: NavIcon;
  readonly items: readonly NavItem[];
}
export type NavEntry = NavItem | NavGroup;
const GROUP_META: Readonly<Record<NavGroupKey, Pick<NavGroup, "labelKey" | "icon">>> = {
  activities: { labelKey: "activities", icon: "gamepad-2" },
};

// [navEntries]: lista plana → entradas con grupos (el grupo ocupa el lugar de su primer ítem; el orden se conserva) | [Patrón]: Pure Function + Composite | [Paradigma]: Funcional
export function navEntries(items: readonly NavItem[]): NavEntry[] {
  const out: NavEntry[] = [];
  for (const item of items) {
    if (!item.group) {
      out.push(item);
      continue;
    }
    const existing = out.find((e): e is NavGroup => "group" in e && e.group === item.group);
    if (existing) (existing.items as NavItem[]).push(item);
    else out.push({ group: item.group, ...GROUP_META[item.group], items: [item] });
  }
  return out;
}
export const isNavGroup = (e: NavEntry): e is NavGroup => "items" in e;

// [Items comunes a todos los roles]: se declaran una sola vez y se reutilizan | [Principio]: DRY
const COURSES_ITEM: NavItem = { href: "/courses", labelKey: "courses", icon: "library" };
const PROFILE_ITEM: NavItem = { href: "/profile/edit", labelKey: "profile", icon: "user-round" };
// [Recursos]: material de estudio publicado (vocabulario, reglas, ejercicios…) visible para todos, igual que Cursos
const RESOURCES_ITEM: NavItem = { href: "/resources", labelKey: "resources", icon: "notebook-text" };
// [Sprint 7.8 · Certificados]: sección PROPIA para todos los roles (no es parte de Recursos ni de Gestión) | `also` → activo también en /verificar
const CERTIFICATES_ITEM: NavItem = { href: "/certificados", labelKey: "certificates", icon: "award", also: ["/verificar"], hard: true };
// [Angular 22]: tutor IA (5.3) y corrector de redacciones con el LLM propio (5.6) — para todos los roles
const ANGULAR_ITEMS: readonly NavItem[] = [
  // [2026-10-23]: «Vocabulario» y «Gramática» salen del menú: ese contenido ya está en Recursos (pestañas). Las rutas /vocabulario, /traductor y /gramatica siguen activas (enlaces desde Recursos)
  // [Actividades · 2026-10-23]: antes un DESPLEGABLE con Juegos, Práctica, Música, Diálogos y Poliglota → ahora UN enlace a /actividades (pestañas como Recursos)
  // `also`: queda activo dentro de cada sección (pantallas del remoto Angular)
  // [2026-10-24]: apunta DIRECTO a la primera sección (Angular /practica) con `hard` → en Angular es routerLink (sin recargar) y en Next.js una sola carga
  // (antes /actividades era una página de Next.js que redirigía → dos cargas completas por clic) | /actividades sigue redirigiendo para enlaces antiguos
  { href: "/practica", labelKey: "activities", icon: "gamepad-2", hard: true, also: ["/actividades", "/juegos", "/musica", "/dialogos", "/poliglota", "/lectura"] }, // [2026-10-25]: + /lectura (Actividades → Lectura)
  // [Traductor · 2026-10-23 · 4.º pase]: ítem PROPIO del menú (antes «Traducción» era un tipo de Recursos) → pantalla estilo Google Translate del remoto Angular (texto o cualquier archivo)
  { href: "/traductor", labelKey: "translator", icon: "languages", hard: true },
  { href: "/tutor", labelKey: "tutor", icon: "sparkles", hard: true },
  { href: "/redaccion", labelKey: "writing", icon: "pen-line", hard: true },
  // [Sprint 7.11]: Centro de ayuda (FAQ, manual por rol y Agente Guía) | `also` → activo también en /ayuda/manual
  { href: "/ayuda/faq", labelKey: "help", icon: "circle-help", also: ["/ayuda"], hard: true },
];

// [Gestión unificada]: el contenido curricular (y los cursos, en admin) viven DENTRO de Gestión como pestañas | [Orden]: "Mi perfil" primero, luego Dashboard
// `Readonly<Record<…>>` (TS): mapa rol → ítems, inmutable en compilación
export const NAV_BY_ROLE: Readonly<Record<PortalRole, readonly NavItem[]>> = {
  estudiante: [
    PROFILE_ITEM,
    { href: "/dashboard/estudiante", labelKey: "dashboard", icon: "layout-grid" },
    COURSES_ITEM,
    RESOURCES_ITEM,
    { href: "/quiz", labelKey: "exams", icon: "file-text" },
    // [Feedback IA]: resumen de exámenes + detalle por pregunta con feedback
    { href: "/feedback", labelKey: "feedback", icon: "message-square" },
    // [Plan de estudio · Angular /estudio/*]: plan y recomendaciones (Sprint 5.2) | `also` → activo también en /estudio/recomendaciones
    { href: "/estudio/plan", labelKey: "studyPlan", icon: "clipboard-list", also: ["/estudio"], hard: true },
    // [Progreso]: tendencia, distribución y leaderboard embebido
    { href: "/profile", labelKey: "progress", icon: "trending-up" },
    CERTIFICATES_ITEM,
    ...ANGULAR_ITEMS, // `...` (ES2015 spread): inserta los ítems comunes sin duplicarlos
  ],
  docente: [
    PROFILE_ITEM,
    { href: "/dashboard/docente", labelKey: "dashboard", icon: "layout-grid" },
    { href: "/teacher/quizzes", labelKey: "management", icon: "users", also: ["/admin/curriculum", "/admin/activities"] },
    { href: "/teacher/students", labelKey: "students", icon: "graduation-cap" },
    COURSES_ITEM,
    RESOURCES_ITEM,
    { href: "/quiz", labelKey: "exams", icon: "file-text" },
    CERTIFICATES_ITEM,
    ...ANGULAR_ITEMS,
  ],
  admin: [
    PROFILE_ITEM,
    { href: "/dashboard/admin", labelKey: "dashboard", icon: "layout-grid" },
    { href: "/admin/users", labelKey: "management", icon: "users", also: ["/admin/curriculum", "/admin/courses", "/admin/activities"] },
    { href: "/teacher/students", labelKey: "students", icon: "graduation-cap" },
    // [Reportes]: activo también en las exportaciones de Angular (/reportes/exportaciones)
    { href: "/admin/reports", labelKey: "reports", icon: "chart-column", also: ["/reportes"] },
    // [Sprint 7.18]: panel de colas y tareas programadas
    { href: "/admin/jobs", labelKey: "jobs", icon: "clipboard-list" },
    COURSES_ITEM,
    RESOURCES_ITEM,
    { href: "/quiz", labelKey: "exams", icon: "file-text" },
    CERTIFICATES_ITEM,
    ...ANGULAR_ITEMS,
  ],
};

// [matchLength]: longitud del prefijo que coincide (0 = no coincide) | [Patrón]: Pure Function
const matchLength = (pathname: string, prefix: string): number =>
  pathname === prefix || pathname.startsWith(prefix + "/") ? prefix.length : 0;

// [activeHrefFor]: href más específico que coincide con la ruta actual | [Paradigma]: Funcional
// [Por qué]: "/profile" y "/profile/edit" coinciden ambos en /profile/edit; el más largo gana. `also` deja Gestión activa en /admin/curriculum
export function activeHrefFor(pathname: string, items: readonly NavItem[]): string | undefined {
  let best: { href: string; len: number } | undefined; // `let` (ES2015): se reasigna dentro del bucle
  for (const item of items) {
    // `Math.max(...array)` (ES2015 spread): mejor coincidencia entre el href y sus prefijos extra
    const len = Math.max(...[item.href, ...(item.also ?? [])].map((p) => matchLength(pathname, p)));
    if (len > 0 && (!best || len > best.len)) best = { href: item.href, len };
  }
  return best?.href; // `?.` (ES2020): undefined si no hay coincidencia
}

// [toPortalRole]: Role del backend NestJS ("USER" | "TEACHER" | "ADMIN") → rol de UI | `null` = sin sesión → estudiante | [Patrón]: Mapper
export function toPortalRole(role: string | null): PortalRole {
  if (role === "TEACHER") return "docente";
  if (role === "ADMIN") return "admin";
  return "estudiante";
}

// [Degradado del avatar por rol]: compartido por sidebar y topbar de ambos frontends | [Principio]: DRY
export const ROLE_GRADIENT: Readonly<Record<PortalRole, string>> = {
  estudiante: "linear-gradient(135deg,#6366f1,#8b5cf6)",
  docente: "linear-gradient(135deg,#06b6d4,#3b82f6)",
  admin: "linear-gradient(135deg,#f59e0b,#ef4444)",
};

// [initialsFromName]: "Ana Pérez" → "AP" | [Patrón]: Pure Function | tolera nombres vacíos
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

// [displayNameFromEmail]: "juan.perez@x.com" → "Juan Perez" (nombre visible del sidebar y del topbar) | [Patrón]: Pure Function
export function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) // Capitaliza cada palabra
    .join(" ");
}

// [Cookie del sidebar]: «1» = oculto en escritorio | la leen el layout de Next.js (servidor) y el shell de Angular
export const SIDEBAR_COOKIE = "sidebar-collapsed";
// [MOBILE_NAV_ID]: id del drawer → `aria-controls` de la hamburguesa y del botón ocultar (WAI-ARIA)
export const MOBILE_NAV_ID = "portal-sidebar";
