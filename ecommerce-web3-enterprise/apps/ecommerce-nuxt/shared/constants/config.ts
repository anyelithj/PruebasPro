// config.ts => constantes de la app (no secretas). Los valores que cambian por entorno viven en runtimeConfig (.env).
export const APP_NAME = "eCommerce Web3";
export const PAGE_SIZE = 12; // Lote moderado: menos datos por petición y menos nodos en memoria
export const ANALYTICS_FLUSH_MS = 30_000; // Los eventos viajan en lotes cada 30 s (no uno por evento)
export const CMS_CACHE_SECONDS = 3600; // Coincide con el ISR de routeRules (nuxt.config.ts)
// nextAppUrl => páginas que viven en Next.js (login único, registro, panel admin, cuenta, checkout) en el idioma actual
// (Next y Nuxt: español sin prefijo, inglés /en). Enlaces <a> normales: es otra aplicación
export const nextAppUrl = (storefrontUrl: string, locale: string, path = "") => `${locale === "es" ? storefrontUrl : `${storefrontUrl}/${locale}`}${path}`;
// storeLoginUrl => login ÚNICO (SSO). callbackUrl=/dashboard: Next deja pasar al ADMIN y devuelve a los clientes a la tienda
export const storeLoginUrl = (storefrontUrl: string, locale: string) => nextAppUrl(storefrontUrl, locale, `/login?callbackUrl=${encodeURIComponent("/dashboard")}`);
export const storeDashboardUrl = (storefrontUrl: string, locale: string) => nextAppUrl(storefrontUrl, locale, "/dashboard");
// Breakpoints de Tailwind en px (useMediaQuery): una sola fuente para JS y CSS
export const BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const;
// CACHE_NAMES => nombres de las cachés del Service Worker (sw/cache-strategies.ts) y del gestor de caché del panel:
// una sola fuente para el SW y la app (DRY). Versionadas: cambiar la versión invalida la caché vieja.
export const CACHE_NAMES = { images: "img-v1", api: "api-v1", pages: "pages-v1" } as const;
