// import tailwindcss from "@tailwindcss/vite";


// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },
  /* ---------- CSS global ---------- */
  css: ['~/assets/css/main.css'],
  /* ---------- Auto‑importación de componentes ---------- */
  // Activa autoimportación de componentes
  components: true,

  /* ---------- TypeScript ---------- */
  // Configura TypeScript
  typescript: {
    strict: true,
    shim: false
  },
  /* ---------- Vite ---------- */
  // vite: {
  //   plugins: [
  //     tailwindcss(),
  //   ],
  // },
   /* ───────── Tailwind CSS ─────────
     (no hace falta config extra; usa assets/css/main.css) */
  tailwindcss: {
    viewer: false,
  },

  /* ---------- Módulos Nuxt ---------- */
  modules: [
    'v-gsap-nuxt',
    '@vee-validate/nuxt',
    '@vesp/nuxt-fontawesome',
    '@nuxtjs/i18n',
    '@vueuse/nuxt',
    'nuxt-particles',
    '@nuxtjs/color-mode',
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
  ],

  /* ---------- Runtime config: consumo de backends (Nest + FastAPI) ---------- */
  // [SRP] URLs de API fuera del código. [STRATEGY] apiProvider elige backend en runtime.
  runtimeConfig: {
    // privado (solo servidor Nitro / BFF)
    fastapiBaseUrl: process.env.FASTAPI_BASE_URL || 'http://localhost:8000/api/v1',
    nestBaseUrl: process.env.NEST_BASE_URL || 'http://localhost:3000/api/v1',
    public: {
      // expuesto al cliente
      apiProvider: process.env.NUXT_PUBLIC_API_PROVIDER || 'nest', // 'nest' | 'fastapi'
      fastapiBaseUrl:
        process.env.NUXT_PUBLIC_FASTAPI_BASE_URL || 'http://localhost:8000/api/v1',
      nestBaseUrl: process.env.NUXT_PUBLIC_NEST_BASE_URL || 'http://localhost:3000/api/v1',
      // Cloudinary: subida directa unsigned desde el navegador (sin backend).
      cloudinaryCloudName: process.env.NUXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '',
      cloudinaryUploadPreset: process.env.NUXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '',
      // URL del CV para el botón de descarga. Default: /cv.pdf en public/.
      cvUrl: process.env.NUXT_PUBLIC_CV_URL || '/cv.pdf',
    },
  },
  /* ---------- Modo oscuro (Tailwind <-> Nuxt) ---------- */
  colorMode: {
    // Sufijo -mode → html recibe `dark-mode`/`light-mode`, NO `.dark`.
    // Tailwind `dark:` no se dispara globalmente; el composable
    // useScopedTheme aplica `.dark` solo en #about, #projects, #skills, #contact.
    classSuffix: '-mode',
    preference: 'system',
    fallback: 'light',
  },
  /* ---------- Internacionalización ---------- */
  i18n: {
    // langDir: 'locales/', // Corregido: solo 'locales/' para evitar duplicación de ruta
    langDir: 'locales', //  ⇠ carpeta donde están tus *.json
    // langDir: 'i18n/locales',
    restructureDir: false,  // mantiene el árbol tal cual
    lazy: true,
    locales: [
      { code: 'es', file: 'es.json', name: 'Español' },
      { code: 'en', file: 'en.json', name: 'English' },
      { code: 'fr', file: 'fr.json', name: 'Français' },
      { code: 'de', file: 'de.json', name: 'Deutsch' },
      { code: 'pt', file: 'pt.json', name: 'Português' }
      // { code: 'es', name: 'Español', file: 'es.json' },
      // { code: 'en', name: 'English', file: 'en.json' },
      // { code: 'fr', name: 'Français', file: 'fr.json' },
      // { code: 'de', name: 'Deutsch', file: 'de.json' },
      // { code: 'pt', name: 'Português', file: 'pt.json' }
    ],
    defaultLocale: 'es',
    // strategy: 'prefix', // rutas como /es, /en, etc.
    /* rutas /  /en  /fr …  (sin prefijo para la predet.)    */
    strategy: 'prefix_except_default',
    //  strategy: 'no_prefix',
    vueI18n: './i18n.config.ts',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      alwaysRedirect: true,
      fallbackLocale: 'es',
    },
    bundle: {
      optimizeTranslationDirective: false // 👈 Agregado aquí para evitar el warning
    }
  },
  /* ---------- tsParticles ---------- */
  particles: {
    mode: 'full', // 'full' | 'slim' | 'basic' | 'custom'
    lazy: true
  },
  /* ---------- HEAD site‑wide ---------- */
  app: {
    head: {
      title: 'Portafolio | Web3 & AI Engineer',
      htmlAttrs: {
        lang: 'es',
      },
      // ✅ RUTA BASE (si deployas en subdirectorio)
      // baseURL: '/mi-portafolio/' ,
      meta: [
        //  { name: 'description', content: 'This is my amazing site.' },
        // { property: 'og:title', content: 'My Amazing Site' },
        // { property: 'og:description', content: 'This is my amazing site.' },
        // { property: 'og:image', content: 'https://example.com/image.png' },
        // { name: 'twitter:card', content: 'summary_large_image' }
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Portafolio profesional de un desarrollador Web3 & AI con Nuxt 3, Tailwind CSS, GSAP, y más.' },
        { name: 'keywords', content: 'Web3, Nuxt 3, AI Engineer, Portfolio, Tailwind CSS, GSAP, VeeValidate' },
        { name: 'author', content: 'Tu Nombre' },
        { name: 'robots', content: 'index, follow' },
        { charset: 'utf-8' }
      ],
     link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        /* Precarga opcional de la fuente para evitar FOIT */
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
      ],
    }
  },
});