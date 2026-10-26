// index.ts (TypeScript) => contratos de datos compartidos entre backend (Express) y frontends (Next, Nuxt).
// Paradigma: tipado estático estructural. Patrón: Shared Kernel (DDD) — una sola definición del contrato HTTP (DRY),
// si el backend cambia la forma de la respuesta, el frontend deja de compilar en vez de fallar en producción.
// Solo exporta "type"/"interface": se borran al compilar, por eso no hace falta build (Just-in-Time package de Turborepo).

// "export" => hace visible el tipo fuera del módulo | "interface" => contrato estructural extensible (OCP)
// "<T>" => genérico: el mismo sobre sirve para cualquier payload (User, Product, Order...)
export interface ApiSuccess<T> {
  // "readonly" => la propiedad no se puede reasignar tras crearse (inmutabilidad de DTOs)
  readonly success: true; // Tipo literal "true": discriminante de la unión ApiResponse (narrowing seguro)
  readonly data: T; // Payload tipado de la respuesta
  readonly message?: string; // "?" => propiedad opcional (mensaje informativo para la UI)
}

// Forma estándar de un error devuelto por la API (lo produce el error.middleware de Express)
export interface ApiError {
  readonly success: false; // Discriminante: "false" permite a TS saber que existe "error" y no "data"
  readonly error: {
    readonly code: string; // Código estable legible por máquina (ej. "AUTH_INVALID_CREDENTIALS")
    readonly message: string; // Mensaje legible por humanos
    readonly details?: unknown; // "unknown" (no "any") => obliga a validar antes de usar (tipado seguro)
  };
}

// "type" => alias de tipo | "|" => unión discriminada por "success" (patrón Result/Either de programación funcional)
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// Metadatos de paginación comunes a todos los listados (productos, órdenes, usuarios)
export interface PaginationMeta {
  readonly page: number; // Página actual (base 1)
  readonly limit: number; // Elementos por página
  readonly total: number; // Total de registros en la fuente
  readonly totalPages: number; // Math.ceil(total / limit), calculado en el backend
}

// Respuesta paginada = respuesta exitosa cuyo payload es un arreglo + metadatos (composición de tipos, no herencia)
export interface PaginatedResponse<T> extends ApiSuccess<readonly T[]> {
  // "extends" => reutiliza ApiSuccess y solo añade "meta" (DRY + OCP)
  readonly meta: PaginationMeta;
}

// ---------- Menú del panel admin (src/admin-nav.json) ----------
// AdminNav => contrato del manifiesto JSON que comparten Next.js y Nuxt (Shared Kernel): ambos menús se dibujan
// desde los mismos datos, así el usuario nunca nota qué microfrontend sirve cada pantalla.
// "Record<Locale, string>" => un texto por idioma soportado (si se agrega un idioma, el compilador lo exige).
export type AdminLocale = "es" | "en";
export interface AdminNavItem {
  readonly key: string; // Identificador estable (clave React/Vue y pruebas)
  readonly app: "next" | "nuxt"; // Aplicación que sirve la ruta (en la otra se navega con <a> normal)
  readonly path: string; // Ruta SIN prefijo de idioma ni base de la app; admite query ("?tab=segments", "?kind=landing")
  readonly icon: string; // Clave de "icons"
  readonly rf?: string; // Requisito funcional (RF) de la especificación que cubre la pantalla (se muestra junto al título)
  readonly adminOnly?: boolean; // true => solo ADMIN (oculto al rol VENDOR y a los clientes)
  readonly match?: readonly string[]; // Prefijos extra de ruta que también activan el ítem ("?" => propiedad opcional)
  readonly label: Readonly<Record<AdminLocale, string>>;
  readonly description?: Readonly<Record<AdminLocale, string>>; // Subtítulo del encabezado de la página (opcional)
}
export interface AdminNavGroup {
  readonly key: string;
  readonly label: Readonly<Record<AdminLocale, string>>;
  readonly everyone?: boolean; // true => grupo visible para toda sesión (sus ítems adminOnly siguen siendo solo ADMIN)
  readonly items: readonly AdminNavItem[];
}
// AdminNavText => claves de texto de la interfaz del panel (una traducción para Next y Nuxt)
export type AdminNavText = "panel" | "menu" | "search" | "noResults" | "collapse" | "expand" | "openMenu" | "closeMenu" | "store" | "notifications" | "online" | "loading" | "breadcrumb" | "themeDark" | "themeLight" | "cart" | "chat" | "more";
export interface AdminNav {
  readonly groups: readonly AdminNavGroup[];
  readonly text: Readonly<Record<AdminNavText, Readonly<Record<AdminLocale, string>>>>;
  readonly roles: Readonly<Record<string, Readonly<Record<AdminLocale, string>>>>; // Nombre visible de cada rol
  readonly icons: Readonly<Record<string, string>>; // Marcado SVG interno (trazos 24x24, contenido estático del repo)
}

// Reglas del menú (las aplican AdminSidebar.tsx y AdminSidebar.vue; este paquete solo exporta tipos, sin runtime):
// - Visibilidad: ADMIN ve todo; un ítem adminOnly solo lo ve ADMIN; los grupos "everyone" (Mi cuenta, IA) los ve toda
//   sesión; VENDOR ve además todo ítem (Next o Nuxt) sin adminOnly.
// - Organización: máximo 6 ítems por grupo, una sola responsabilidad por grupo, acordeón exclusivo (un grupo abierto).
// - Query en "path": el ítem cuya query coincide con la URL gana (puntaje +1) sobre el mismo path sin query.
// - Inicio del panel: ADMIN -> /dashboard (resumen); VENDOR -> /dashboard/products (su catálogo); resto -> /account.
// - Ítem activo: el de ruta (o "match") más larga que coincide con la URL (/account no queda activo en /account/orders).
