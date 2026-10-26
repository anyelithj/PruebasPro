# 🛠️ Frontend Nuxt.js 3 — Guía de Creación desde Cero (Git Bash + pnpm)

> Proyecto: **ecommerce-nuxt** · Basado en `05_NUXTJS3.md`, `ecommerce_matriz_trazabilidad_v34.xlsx` (hoja "🛠️ Nuxt.js 3") y `ESPECIFICACION_TECNICA_UNIFICADA.md`.

⚠️ Igual que en Next.js: **Sass no aparece** en el Excel ni en la especificación para Nuxt (ahí se documenta **Tailwind CSS + Nuxt UI**, no Sass). No lo incluí por la misma regla que me pediste (no agregar dependencias que no estén en los documentos). Si lo quieres de todas formas, es un solo paso: `pnpm add -D sass`.

---

## 0. Prerrequisitos (Git Bash)

```bash
node -v        # Node 20+
pnpm -v
```

---

## 1. Crear el proyecto desde cero

```bash
pnpm dlx nuxi@latest init ecommerce-nuxt
cd ecommerce-nuxt
pnpm install
```

🔄 **Versión instalada: Nuxt 4** (`nuxi init` instala la última). Se mantiene Nuxt 4 porque Nuxt 3 dejó de recibir soporte en julio de 2026; el código de la especificación (Vue 3, Composition API, Pinia) es el mismo. Diferencia de estructura: en Nuxt 4 el código de la app vive en `app/`, así que **`layouts/`, `middleware/` y `plugins/` van dentro de `app/`** (fuera de ahí Nuxt 4 no los carga). `server/`, `i18n/`, `public/` y `content/` siguen en la raíz.

✅ **Calidad:** `pnpm lint` (ESLint con `@nuxt/eslint`) y `pnpm typecheck` (`nuxt typecheck` con vue-tsc). Husky y lint-staged de la raíz del monorepo también cubren Nuxt.

---

## 2. Instalar dependencias (pnpm)

### 2.1 State management

```bash
pnpm add pinia @pinia/nuxt
```

### 2.2 Estilos — Tailwind CSS + Nuxt UI

```bash
pnpm add -D @nuxtjs/tailwindcss
pnpm add @nuxt/ui
```

### 2.3 GraphQL (Apollo Client)

```bash
pnpm add -D @nuxtjs/apollo
pnpm add @apollo/client graphql
```

### 2.4 HTTP client

```bash
pnpm add axios
```

### 2.5 Formularios y validación

```bash
pnpm add vee-validate zod @vee-validate/zod
```

### 2.6 CMS y editor visual

```bash
pnpm add -D @nuxt/content
pnpm add grapesjs
```

### 2.7 PWA (offline, push, background sync)

```bash
pnpm add -D @vite-pwa/nuxt
pnpm add workbox-window
```

### 2.8 SEO

```bash
pnpm add -D @nuxtjs/seo
```

### 2.9 Animaciones

```bash
pnpm add gsap
```

### 2.10 Internacionalización

```bash
pnpm add @nuxtjs/i18n
```

### 2.11 Medios (Cloudinary)

```bash
pnpm add cloudinary
```

### 2.12 Gráficas (dashboards / analytics del CMS)

```bash
pnpm add chart.js vue-chartjs
```

---

## 3. Crear la estructura completa de carpetas y archivos

> Generado automáticamente a partir del árbol exacto de `05_NUXTJS3.md` (6 módulos activos: CMS, Landing, PWA). `nuxi init` ya crea la base del proyecto; estos comandos son idempotentes y completan el resto de la estructura.

```bash
mkdir -p \
  "ecommerce-nuxt/app" \
  "ecommerce-nuxt/app/landing" \
  "ecommerce-nuxt/app/landing/[slug]" \
  "ecommerce-nuxt/app/cms-page" \
  "ecommerce-nuxt/app/cms-page/new" \
  "ecommerce-nuxt/app/cms-page/[slug]" \
  "ecommerce-nuxt/app/cms-page/[slug]/edit" \
  "ecommerce-nuxt/app/cms-lookbook" \
  "ecommerce-nuxt/app/cms-lookbook/new" \
  "ecommerce-nuxt/app/cms-lookbook/[slug]" \
  "ecommerce-nuxt/app/cms-lookbook/[slug]/edit" \
  "ecommerce-nuxt/app/cms-collection" \
  "ecommerce-nuxt/app/cms-collection/new" \
  "ecommerce-nuxt/app/cms-collection/[slug]" \
  "ecommerce-nuxt/app/cms-collection/[slug]/edit" \
  "ecommerce-nuxt/app/categories" \
  "ecommerce-nuxt/app/categories/[slug]" \
  "ecommerce-nuxt/app/events" \
  "ecommerce-nuxt/app/events/[slug]" \
  "ecommerce-nuxt/app/blog" \
  "ecommerce-nuxt/app/blog/[slug]" \
  "ecommerce-nuxt/app/social" \
  "ecommerce-nuxt/app/social/products" \
  "ecommerce-nuxt/app/social/products/[id]" \
  "ecommerce-nuxt/app/social/checkout" \
  "ecommerce-nuxt/app/social/analytics" \
  "ecommerce-nuxt/app/social/influencers" \
  "ecommerce-nuxt/app/social/influencers/[id]" \
  "ecommerce-nuxt/app/pwa" \
  "ecommerce-nuxt/app/pwa/install" \
  "ecommerce-nuxt/app/pwa/offline" \
  "ecommerce-nuxt/app/pwa/notifications" \
  "ecommerce-nuxt/app/pwa/cache" \
  "ecommerce-nuxt/app/config" \
  "ecommerce-nuxt/app/config/payments" \
  "ecommerce-nuxt/app/config/shipping" \
  "ecommerce-nuxt/features" \
  "ecommerce-nuxt/features/landing" \
  "ecommerce-nuxt/features/landing/ui" \
  "ecommerce-nuxt/features/landing/model" \
  "ecommerce-nuxt/features/landing/api" \
  "ecommerce-nuxt/features/landing/composable" \
  "ecommerce-nuxt/features/landing/lib" \
  "ecommerce-nuxt/features/cms" \
  "ecommerce-nuxt/features/cms/ui" \
  "ecommerce-nuxt/features/cms/model" \
  "ecommerce-nuxt/features/cms/api" \
  "ecommerce-nuxt/features/cms/composable" \
  "ecommerce-nuxt/features/cms/lib" \
  "ecommerce-nuxt/features/seo" \
  "ecommerce-nuxt/features/seo/ui" \
  "ecommerce-nuxt/features/seo/model" \
  "ecommerce-nuxt/features/seo/api" \
  "ecommerce-nuxt/features/seo/composable" \
  "ecommerce-nuxt/features/seo/lib" \
  "ecommerce-nuxt/features/social-commerce" \
  "ecommerce-nuxt/features/social-commerce/ui" \
  "ecommerce-nuxt/features/social-commerce/model" \
  "ecommerce-nuxt/features/social-commerce/api" \
  "ecommerce-nuxt/features/social-commerce/composable" \
  "ecommerce-nuxt/features/social-commerce/lib" \
  "ecommerce-nuxt/features/pwa" \
  "ecommerce-nuxt/features/pwa/ui" \
  "ecommerce-nuxt/features/pwa/model" \
  "ecommerce-nuxt/features/pwa/api" \
  "ecommerce-nuxt/features/pwa/composable" \
  "ecommerce-nuxt/features/pwa/lib" \
  "ecommerce-nuxt/features/config" \
  "ecommerce-nuxt/features/config/ui" \
  "ecommerce-nuxt/features/config/model" \
  "ecommerce-nuxt/features/config/api" \
  "ecommerce-nuxt/features/config/composable" \
  "ecommerce-nuxt/features/config/lib" \
  "ecommerce-nuxt/widgets" \
  "ecommerce-nuxt/widgets/landing" \
  "ecommerce-nuxt/widgets/cms" \
  "ecommerce-nuxt/widgets/seo" \
  "ecommerce-nuxt/widgets/social" \
  "ecommerce-nuxt/widgets/pwa" \
  "ecommerce-nuxt/widgets/navigation" \
  "ecommerce-nuxt/entities" \
  "ecommerce-nuxt/entities/landing" \
  "ecommerce-nuxt/entities/landing/model" \
  "ecommerce-nuxt/entities/cms" \
  "ecommerce-nuxt/entities/cms/model" \
  "ecommerce-nuxt/entities/blog" \
  "ecommerce-nuxt/entities/blog/model" \
  "ecommerce-nuxt/entities/social" \
  "ecommerce-nuxt/entities/social/model" \
  "ecommerce-nuxt/entities/pwa" \
  "ecommerce-nuxt/entities/pwa/model" \
  "ecommerce-nuxt/shared" \
  "ecommerce-nuxt/shared/ui" \
  "ecommerce-nuxt/shared/composable" \
  "ecommerce-nuxt/shared/lib" \
  "ecommerce-nuxt/shared/types" \
  "ecommerce-nuxt/shared/constants" \
  "ecommerce-nuxt/server" \
  "ecommerce-nuxt/server/middleware" \
  "ecommerce-nuxt/server/api" \
  "ecommerce-nuxt/server/api/webhooks" \
  "ecommerce-nuxt/app/plugins" \
  "ecommerce-nuxt/app/layouts" \
  "ecommerce-nuxt/app/middleware" \
  "ecommerce-nuxt/public" \
  "ecommerce-nuxt/public/icons" \
  "ecommerce-nuxt/public/images" \
  "ecommerce-nuxt/public/fonts" \
  "ecommerce-nuxt/content" \
  "ecommerce-nuxt/content/blog" \
  "ecommerce-nuxt/content/pages" \
  "ecommerce-nuxt/content/docs" \
  "ecommerce-nuxt/i18n" \
  "ecommerce-nuxt/sw" \
  "ecommerce-nuxt"

touch \
  "ecommerce-nuxt/app/landing/page.vue" \
  "ecommerce-nuxt/app/landing/[slug]/page.vue" \
  "ecommerce-nuxt/app/cms-page/page.vue" \
  "ecommerce-nuxt/app/cms-page/new/page.vue" \
  "ecommerce-nuxt/app/cms-page/[slug]/page.vue" \
  "ecommerce-nuxt/app/cms-page/[slug]/edit/page.vue" \
  "ecommerce-nuxt/app/cms-lookbook/page.vue" \
  "ecommerce-nuxt/app/cms-lookbook/new/page.vue" \
  "ecommerce-nuxt/app/cms-lookbook/[slug]/page.vue" \
  "ecommerce-nuxt/app/cms-lookbook/[slug]/edit/page.vue" \
  "ecommerce-nuxt/app/cms-collection/page.vue" \
  "ecommerce-nuxt/app/cms-collection/new/page.vue" \
  "ecommerce-nuxt/app/cms-collection/[slug]/page.vue" \
  "ecommerce-nuxt/app/cms-collection/[slug]/edit/page.vue" \
  "ecommerce-nuxt/app/categories/page.vue" \
  "ecommerce-nuxt/app/categories/[slug]/page.vue" \
  "ecommerce-nuxt/app/events/page.vue" \
  "ecommerce-nuxt/app/events/[slug]/page.vue" \
  "ecommerce-nuxt/app/blog/page.vue" \
  "ecommerce-nuxt/app/blog/[slug]/page.vue" \
  "ecommerce-nuxt/app/social/products/page.vue" \
  "ecommerce-nuxt/app/social/products/[id]/page.vue" \
  "ecommerce-nuxt/app/social/checkout/page.vue" \
  "ecommerce-nuxt/app/social/analytics/page.vue" \
  "ecommerce-nuxt/app/social/influencers/page.vue" \
  "ecommerce-nuxt/app/social/influencers/[id]/page.vue" \
  "ecommerce-nuxt/app/pwa/install/page.vue" \
  "ecommerce-nuxt/app/pwa/offline/page.vue" \
  "ecommerce-nuxt/app/pwa/notifications/page.vue" \
  "ecommerce-nuxt/app/pwa/cache/page.vue" \
  "ecommerce-nuxt/app/config/payments/page.vue" \
  "ecommerce-nuxt/app/config/shipping/page.vue" \
  "ecommerce-nuxt/app/error.vue" \
  "ecommerce-nuxt/app/app.vue" \
  "ecommerce-nuxt/features/landing/ui/LeadCaptureForm.vue" \
  "ecommerce-nuxt/features/landing/ui/HeroSection.vue" \
  "ecommerce-nuxt/features/landing/ui/CountdownTimer.vue" \
  "ecommerce-nuxt/features/landing/ui/TestimonialSlider.vue" \
  "ecommerce-nuxt/features/landing/model/landing.store.ts" \
  "ecommerce-nuxt/features/landing/api/landing.api.ts" \
  "ecommerce-nuxt/features/landing/composable/useLanding.ts" \
  "ecommerce-nuxt/features/landing/lib/landing.validator.ts" \
  "ecommerce-nuxt/features/cms/ui/CMSPageEditor.vue" \
  "ecommerce-nuxt/features/cms/ui/CMSBlockRenderer.vue" \
  "ecommerce-nuxt/features/cms/ui/LookbookGrid.vue" \
  "ecommerce-nuxt/features/cms/ui/CollectionBanner.vue" \
  "ecommerce-nuxt/features/cms/ui/CMSPreview.vue" \
  "ecommerce-nuxt/features/cms/model/cms.store.ts" \
  "ecommerce-nuxt/features/cms/api/cms.api.ts" \
  "ecommerce-nuxt/features/cms/composable/useCMSEditor.ts" \
  "ecommerce-nuxt/features/cms/composable/useCMSBlocks.ts" \
  "ecommerce-nuxt/features/cms/lib/cms.validator.ts" \
  "ecommerce-nuxt/features/seo/ui/BlogPostCard.vue" \
  "ecommerce-nuxt/features/seo/ui/BlogPostContent.vue" \
  "ecommerce-nuxt/features/seo/ui/EventCard.vue" \
  "ecommerce-nuxt/features/seo/ui/CategoryBreadcrumb.vue" \
  "ecommerce-nuxt/features/seo/ui/SchemaOrgMeta.vue" \
  "ecommerce-nuxt/features/seo/model/seo.store.ts" \
  "ecommerce-nuxt/features/seo/api/seo.api.ts" \
  "ecommerce-nuxt/features/seo/composable/useSEOMeta.ts" \
  "ecommerce-nuxt/features/seo/lib/seo.validator.ts" \
  "ecommerce-nuxt/features/social-commerce/ui/SocialProductCard.vue" \
  "ecommerce-nuxt/features/social-commerce/ui/SocialCheckoutForm.vue" \
  "ecommerce-nuxt/features/social-commerce/ui/InfluencerCard.vue" \
  "ecommerce-nuxt/features/social-commerce/ui/SocialAnalyticsDash.vue" \
  "ecommerce-nuxt/features/social-commerce/ui/CommissionTracker.vue" \
  "ecommerce-nuxt/features/social-commerce/model/social.store.ts" \
  "ecommerce-nuxt/features/social-commerce/api/social.api.ts" \
  "ecommerce-nuxt/features/social-commerce/composable/useSocialCommerce.ts" \
  "ecommerce-nuxt/features/social-commerce/lib/social.validator.ts" \
  "ecommerce-nuxt/features/pwa/ui/InstallPrompt.vue" \
  "ecommerce-nuxt/features/pwa/ui/OfflineIndicator.vue" \
  "ecommerce-nuxt/features/pwa/ui/PushToggle.vue" \
  "ecommerce-nuxt/features/pwa/ui/CacheStatus.vue" \
  "ecommerce-nuxt/features/pwa/ui/UpdateBanner.vue" \
  "ecommerce-nuxt/features/pwa/model/pwa.store.ts" \
  "ecommerce-nuxt/features/pwa/api/pwa.api.ts" \
  "ecommerce-nuxt/features/pwa/composable/usePWAInstall.ts" \
  "ecommerce-nuxt/features/pwa/composable/usePushNotif.ts" \
  "ecommerce-nuxt/features/pwa/composable/useCacheManager.ts" \
  "ecommerce-nuxt/features/pwa/lib/pwa.validator.ts" \
  "ecommerce-nuxt/features/config/ui/PaymentGatewayForm.vue" \
  "ecommerce-nuxt/features/config/ui/ShippingCarrierForm.vue" \
  "ecommerce-nuxt/features/config/ui/TaxRatesForm.vue" \
  "ecommerce-nuxt/features/config/ui/StoreCurrencyForm.vue" \
  "ecommerce-nuxt/features/config/model/config.store.ts" \
  "ecommerce-nuxt/features/config/api/config.api.ts" \
  "ecommerce-nuxt/features/config/composable/useStoreConfig.ts" \
  "ecommerce-nuxt/features/config/lib/config.validator.ts" \
  "ecommerce-nuxt/widgets/landing/LandingCard.vue" \
  "ecommerce-nuxt/widgets/landing/LandingHero.vue" \
  "ecommerce-nuxt/widgets/landing/CountdownTimer.vue" \
  "ecommerce-nuxt/widgets/cms/CMSNavigation.vue" \
  "ecommerce-nuxt/widgets/cms/CMSToolbar.vue" \
  "ecommerce-nuxt/widgets/seo/BlogSidebar.vue" \
  "ecommerce-nuxt/widgets/seo/RelatedPosts.vue" \
  "ecommerce-nuxt/widgets/social/SocialFeedWidget.vue" \
  "ecommerce-nuxt/widgets/social/InfluencerRanking.vue" \
  "ecommerce-nuxt/widgets/pwa/PWAStatusBar.vue" \
  "ecommerce-nuxt/widgets/navigation/AdminHeader.vue" \
  "ecommerce-nuxt/widgets/navigation/AdminSidebar.vue" \
  "ecommerce-nuxt/widgets/navigation/BreadcrumbNav.vue" \
  "ecommerce-nuxt/entities/landing/model/landing.types.ts" \
  "ecommerce-nuxt/entities/cms/model/cms.types.ts" \
  "ecommerce-nuxt/entities/blog/model/blog.types.ts" \
  "ecommerce-nuxt/entities/social/model/social.types.ts" \
  "ecommerce-nuxt/entities/pwa/model/pwa.types.ts" \
  "ecommerce-nuxt/shared/ui/Button.vue" \
  "ecommerce-nuxt/shared/ui/Input.vue" \
  "ecommerce-nuxt/shared/ui/Modal.vue" \
  "ecommerce-nuxt/shared/ui/Toast.vue" \
  "ecommerce-nuxt/shared/ui/Skeleton.vue" \
  "ecommerce-nuxt/shared/ui/Badge.vue" \
  "ecommerce-nuxt/shared/ui/DataTable.vue" \
  "ecommerce-nuxt/shared/ui/Pagination.vue" \
  "ecommerce-nuxt/shared/ui/EmptyState.vue" \
  "ecommerce-nuxt/shared/composable/useAuth.ts" \
  "ecommerce-nuxt/shared/composable/useToast.ts" \
  "ecommerce-nuxt/shared/composable/useMediaQuery.ts" \
  "ecommerce-nuxt/shared/composable/useDebounce.ts" \
  "ecommerce-nuxt/shared/composable/useInfiniteScroll.ts" \
  "ecommerce-nuxt/shared/composable/useWebSocket.ts" \
  "ecommerce-nuxt/shared/composable/useCountdown.ts" \
  "ecommerce-nuxt/shared/lib/api-client.ts" \
  "ecommerce-nuxt/shared/lib/auth-config.ts" \
  "ecommerce-nuxt/shared/lib/format.ts" \
  "ecommerce-nuxt/shared/lib/cn.ts" \
  "ecommerce-nuxt/shared/lib/analytics.ts" \
  "ecommerce-nuxt/shared/types/api.types.ts" \
  "ecommerce-nuxt/shared/types/common.types.ts" \
  "ecommerce-nuxt/shared/types/nuxt.types.ts" \
  "ecommerce-nuxt/shared/constants/routes.ts" \
  "ecommerce-nuxt/shared/constants/config.ts" \
  "ecommerce-nuxt/server/middleware/auth.ts" \
  "ecommerce-nuxt/server/middleware/logger.ts" \
  "ecommerce-nuxt/server/api/webhooks/[provider].ts" \
  "ecommerce-nuxt/app/plugins/pinia.ts" \
  "ecommerce-nuxt/app/plugins/vee-validate.ts" \
  "ecommerce-nuxt/app/plugins/analytics.client.ts" \
  "ecommerce-nuxt/app/layouts/default.vue" \
  "ecommerce-nuxt/app/layouts/admin.vue" \
  "ecommerce-nuxt/app/layouts/landing.vue" \
  "ecommerce-nuxt/app/layouts/cms.vue" \
  "ecommerce-nuxt/app/layouts/blank.vue" \
  "ecommerce-nuxt/app/middleware/auth.ts" \
  "ecommerce-nuxt/app/middleware/rbac.ts" \
  "ecommerce-nuxt/app/middleware/analytics.ts" \
  "ecommerce-nuxt/public/manifest.webmanifest" \
  "ecommerce-nuxt/i18n/es.json" \
  "ecommerce-nuxt/i18n/en.json" \
  "ecommerce-nuxt/sw/sw.ts" \
  "ecommerce-nuxt/sw/cache-strategies.ts" \
  "ecommerce-nuxt/sw/push-handler.ts" \
  "ecommerce-nuxt/.env" \
  "ecommerce-nuxt/.env.example" \
  "ecommerce-nuxt/nuxt.config.ts" \
  "ecommerce-nuxt/tailwind.config.ts" \
  "ecommerce-nuxt/tsconfig.json" \
  "ecommerce-nuxt/package.json"
```

---

## 4. Levantar el proyecto

```bash
pnpm dev
```
