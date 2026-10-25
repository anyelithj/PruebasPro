// nuxt.config.ts (Nuxt 4 / Nitro) => configuración del panel ADMIN + VENDOR y de las páginas públicas de contenido
// (landings, CMS, blog, eventos, categorías SEO) y de la PWA (Fase 8).
// Rendimiento / ecología: SSG + ISR en las páginas públicas (se renderizan una vez y se sirven desde caché), panel
// admin solo en el navegador (ssr: false: el servidor no gasta CPU en pantallas privadas), sin devtools, GrapesJS con
// import dinámico y Service Worker con caché de assets (menos transferencia de red en cada visita).
// Patrón: Configuration as Code + Convention over Configuration (estructura FSD declarada en "dir" y en el hook pages).
import type { NuxtPage } from "@nuxt/schema";

// flattenPages => el árbol del spec usa "carpeta/page.vue" (estilo App Router): se toma SOLO cada page.vue y su ruta se
// calcula sin el sufijo "/page". Así layouts, middleware y plugins dentro de app/ nunca se vuelven rutas (función pura).
function flattenPages(pages: NuxtPage[]): NuxtPage[] {
  return pages.flatMap((page) => [page, ...flattenPages(page.children ?? [])]).filter((page) => page.file?.endsWith("/page.vue"));
}

// BASE => Nuxt vive bajo /cms/ (microfrontend montado por el gateway Nginx junto a Next.js, que ocupa "/").
// Así sus rutas (/login, /api, /social, /categories) nunca chocan con las de la tienda. NUXT_APP_BASE_URL lo cambia.
const BASE = process.env.NUXT_APP_BASE_URL ?? "/cms/";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: false }, // Devtools consume memoria y CPU en cada recarga: se activan solo si se necesitan

  // Módulos (todos open source): ESLint, Pinia (Client State), VueUse, Tailwind, i18n, Nuxt Content (blog MDC) y PWA
  modules: ["@nuxt/eslint", "@pinia/nuxt", "@vueuse/nuxt", "@nuxtjs/tailwindcss", "@nuxtjs/i18n", "@nuxt/content", "@vite-pwa/nuxt"],
  // cssPath explícito: sin esto el módulo no encontraba app/assets/css/tailwind.css (srcDir de Nuxt 4) y cargaba el
  // tailwind.css vacío de la librería => sin variables --slate-* (menú sin fondo, grises rotos, tema oscuro sin efecto)
  tailwindcss: { cssPath: "~/assets/css/tailwind.css" },

  // "dir.pages: '.'" => las rutas viven en app/<sección>/page.vue (árbol de 05_NUXTJS3.md); el hook las normaliza
  dir: { pages: "." },
  hooks: {
    "pages:extend"(pages) {
      const routes = flattenPages(pages).map(({ children: _children, ...page }) => ({
        ...page,
        path: page.path.replace(/\/page$/, "") || "/",
        ...(page.name ? { name: page.name.replace(/-page$/, "") } : {}),
      }));
      pages.splice(0, pages.length, ...routes); // Reemplaza en el mismo arreglo (Nuxt lo lee por referencia)
    },
  },

  // runtimeConfig => NUXT_* (servidor) y NUXT_PUBLIC_* (navegador) desde .env (12-Factor: config en el entorno)
  runtimeConfig: {
    apiInternalUrl: "http://localhost:4000/api/v1", // Express visto desde Nitro (en Docker: red interna)
    webhookSecret: "", // HMAC de los webhooks entrantes (server/api/webhooks)
    storefrontInternalUrl: "http://localhost:3000", // Next.js visto desde Nitro: el SSO lee /api/auth/session
    public: {
      apiUrl: "http://localhost:4000/api/v1",
      siteUrl: "http://localhost:3001",
      storefrontUrl: "http://localhost:3000", // Tienda Next.js (fichas de producto y checkout real)
      vapidPublicKey: "", // Llave PÚBLICA VAPID para Web Push (la privada vive solo en Express)
    },
  },

  app: {
    baseURL: BASE,
    head: {
      htmlAttrs: { lang: "es" },
      titleTemplate: "%s · eCommerce Web3",
      meta: [{ name: "theme-color", content: "#0f172a" }],
      // Tema antes de pintar (cookie "theme" compartida con Next.js; sin cookie => preferencia del sistema): sin parpadeo
      script: [{ innerHTML: `(function(){try{var m=document.cookie.match(/(?:^|; )theme=(dark|light)/);var d=m?m[1]==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}})()`, tagPosition: "head" }],
      link: [
        { rel: "icon", href: `${BASE}favicon.ico` },
        { rel: "manifest", href: `${BASE}manifest.webmanifest` },
        // Inter = misma fuente que Next.js (next/font): panel y tienda se ven iguales en las dos apps
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
        { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
      ],
    },
  },

  // routeRules => estrategia de render por ruta (Strategy declarativo de Nitro)
  routeRules: {
    // Tienda: portada y catálogo con ISR corto (precios y stock cambian); carrito privado solo en el navegador
    "/": { isr: 60 },
    "/products/**": { isr: 60 },
    "/cart": { ssr: false },
    // Públicas: ISR (se regeneran en segundo plano como máximo cada hora; los webhooks del CMS las purgan antes)
    "/landing/**": { isr: 3600 },
    "/cms-page/**": { isr: 3600 },
    "/cms-lookbook/**": { isr: 3600 },
    "/cms-collection/**": { isr: 3600 },
    "/categories/**": { isr: 3600 },
    "/brands/**": { isr: 3600 }, // RF-05.4 landing de marcas (SEO, misma política que categorías)
    "/events/**": { isr: 3600 },
    "/blog/**": { isr: 86400 }, // Markdown versionado: cambia solo con un despliegue
    // Edición y paneles privados: solo navegador (sin SSR ni caché compartida de datos privados)
    "/cms-page": { ssr: false }, // Listado privado del CMS: sin SSR ni ISR (antes caía en la regla ISR de "/cms-page/**")
    "/cms-page/new": { ssr: false },
    "/cms-page/*/edit": { ssr: false },
    "/cms-collection/new": { ssr: false },
    "/cms-collection/*/edit": { ssr: false },
    "/social/**": { ssr: false },
    "/config/**": { ssr: false },
    "/pwa/**": { ssr: false },
    "/pwa/offline": { prerender: true }, // Página que el Service Worker sirve sin conexión
  },

  // i18n (@nuxtjs/i18n): español sin prefijo, inglés en /en; diccionarios en i18n/es.json e i18n/en.json
  i18n: {
    restructureDir: "i18n",
    langDir: ".",
    defaultLocale: "es",
    strategy: "prefix_except_default",
    locales: [
      { code: "es", language: "es-CO", file: "es.json", name: "Español" },
      { code: "en", language: "en-US", file: "en.json", name: "English" },
    ],
    detectBrowserLanguage: false, // Sin redirecciones por cabecera: URLs estables para SEO
  },

  // Nuxt Content v3: SQLite NATIVO de Node 22 (sin compilar better-sqlite3: menos dependencias nativas)
  content: { experimental: { sqliteConnector: "native" } },

  // PWA (@vite-pwa/nuxt + Workbox): Service Worker propio (sw/sw.ts) y manifest estático en public/
  pwa: {
    strategies: "injectManifest",
    srcDir: "../sw", // Relativo a app/ (srcDir de Nuxt 4)
    filename: "sw.ts",
    registerType: "prompt", // El usuario decide cuándo actualizar (UpdateBanner): nunca se recarga solo
    manifest: false, // Se usa public/manifest.webmanifest
    injectManifest: { globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2,webmanifest}"] },
    client: { installPrompt: true },
    devOptions: { enabled: false }, // En desarrollo no hay SW (evita cachés confusas)
  },

  typescript: { strict: true },
})
