// [Temas visuales como configuración]: los 6 temas de NeuroLearning (claro, oscuro, sepia, alto contraste, deep focus, VR) | [Patrón]: Configuration Object + SSOT | [Principio]: OCP (añadir tema = añadir una entrada + su bloque CSS) | [Paradigma]: Declarativo
// [@aula/ui-tokens · Sprint 7.1 · RF-70]: preset de temas de Tailwind CSS 4 compartido por Next.js y Angular — qué temas existen, su metadato y el script anti-parpadeo; los colores (tokens CSS por tema) viven en apps/frontend-next/src/app/globals.css (bloques `.light`, `.dark`…) y el movimiento reducido en ./motion.css
// [Tecnología]: TypeScript puro sin dependencias (Tailwind 4 se configura en CSS; este preset aporta la lista tipada de temas) → importable desde Server/Client Components y desde Angular por el alias @aula/*

// `export const` (ES Modules): tupla pública | `as const` (TS): congela los literales → el tipo es "light" | "dark" | … y no `string`
export const THEMES = ["light", "dark", "sepia", "hcontrast", "deepfocus", "vr"] as const;

// `typeof THEMES[number]` (TS indexed access): deriva la unión de literales desde la tupla | [Principio]: DRY (una sola lista)
export type ThemeKey = (typeof THEMES)[number];

// `interface` (TS): contrato de la metadata visual de cada tema (se borra al compilar, coste cero en runtime)
export interface ThemeMeta {
  readonly icon: string; // Emoji del pill del selector (igual al topbar de NeuroLearning)
  readonly dot: string; // Color de fondo del punto de muestra
  readonly border: string; // Color de borde/acento del punto de muestra
}

// `Readonly<Record<K, V>>` (TS utility types): mapa inmutable y exhaustivo → si falta un tema el compilador avisa | [Patrón]: Lookup Table
export const THEME_META: Readonly<Record<ThemeKey, ThemeMeta>> = Object.freeze({
  light: { icon: "☀", dot: "#FFFFFF", border: "#6366F1" }, // Borde en índigo de marca (se conserva el degradado morado)
  dark: { icon: "🌙", dot: "#0A0A1A", border: "#8B5CF6" },
  sepia: { icon: "📜", dot: "#F4ECD8", border: "#8B5E3C" },
  hcontrast: { icon: "⚡", dot: "#000000", border: "#FFE000" },
  deepfocus: { icon: "🎯", dot: "#0D1117", border: "#58A6FF" },
  vr: { icon: "🥽", dot: "#050010", border: "#BF00FF" },
});

export const DEFAULT_THEME: ThemeKey = "light"; // Tema inicial si el usuario nunca eligió uno
export const THEME_STORAGE_KEY = "ui-theme"; // Clave en localStorage (preferencia por navegador, no es dato sensible)

// [Type guard]: `value is ThemeKey` (TS) estrecha `unknown` a la unión tras validar en runtime | [Principio]: Tipado seguro
export const isTheme = (value: unknown): value is ThemeKey =>
  typeof value === "string" && (THEMES as readonly string[]).includes(value);

// [Temas de las páginas públicas]: landing, login y registro solo ofrecen Claro y Oscuro (claro por defecto) | [Principio]: SSOT
export const PUBLIC_THEMES: ReadonlyArray<ThemeKey> = ["light", "dark"];
// [Rutas públicas]: donde se limita el tema (el portal conserva los 6)
export const PUBLIC_PATHS: ReadonlyArray<string> = ["/", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/terms"];

// [Script anti-parpadeo]: se inyecta en <head> y aplica la clase del tema ANTES del primer pintado (evita el "flash" de tema) | [Patrón]: Blocking Inline Script
// `JSON.stringify` (JS): serializa listas/claves de forma segura dentro del string | IIFE `(function(){…})()` (JS): ejecuta al instante sin contaminar el scope global
// [Páginas públicas]: si el tema guardado no es claro/oscuro (p. ej. sepia del portal) se muestra claro SIN borrar la preferencia
// `try/catch`: localStorage puede lanzar (modo privado, cookies bloqueadas) → se queda el tema por defecto
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var all=${JSON.stringify(THEMES)};if(all.indexOf(t)<0)t=${JSON.stringify(DEFAULT_THEME)};var pub=${JSON.stringify(PUBLIC_PATHS)}.indexOf(location.pathname)>=0;if(pub&&${JSON.stringify(PUBLIC_THEMES)}.indexOf(t)<0)t=${JSON.stringify(DEFAULT_THEME)};document.documentElement.classList.add(t);}catch(e){document.documentElement.classList.add(${JSON.stringify(DEFAULT_THEME)});}})();`;
