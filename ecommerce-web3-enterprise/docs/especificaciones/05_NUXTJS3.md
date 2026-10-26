# 🛠️ FRONTEND — Nuxt.js 3
## eCommerce Web3 Enterprise · FSD Feature-Sliced Design · 17 Módulos
## Composition API · Pinia · Vee-Validate · Zod · GrapesJS · Workbox · PWA · Nuxt Content · VueUse

---

```
ecommerce-nuxt/
├── app/                                 # App Router — Nuxt 3 entry points
│   │
│   ├── ── LANDING PAGES ────────────────────────────────────
│   │
│   ├── landing/
│   │   ├── page.vue                     # RSC·SSG|Observer|FSD|Async·Vue|Landings list
│   │   └── [slug]/
│   │       └── page.vue                 # RSC·SSG·ISR|Observer|FSD|Async·Vue|Landing detail
│   │
│   ├── ── CMS PAGES ────────────────────────────────────────
│   │
│   ├── cms-page/
│   │   ├── page.vue                     # RSC·SSR|Guard|FSD|Async·Vue|CMS list
│   │   ├── new/
│   │   │   └── page.vue                 # RSC·SSR|Guard·RBAC|FSD|Async·Vue|CMS·CREATE
│   │   └── [slug]/
│   │       ├── page.vue                 # RSC·SSG·ISR|Observer|FSD|Async·Vue|CMS detail
│   │       └── edit/
│   │           └── page.vue             # RSC·SSR|Guard·RBAC|FSD|Async·Vue|CMS·UPDATE
│   │
│   ├── ── CMS LOOKBOOKS ────────────────────────────────────
│   │
│   ├── cms-lookbook/
│   │   ├── page.vue                     # RSC·SSR|Guard|FSD|Async·Vue|Lookbook list
│   │   ├── new/
│   │   │   └── page.vue                 # RSC·SSR|Guard·RBAC|FSD|Async·Vue|Lookbook·CREATE
│   │   └── [slug]/
│   │       ├── page.vue                 # RSC·SSG·ISR|Observer|FSD|Async·Vue|Lookbook detail
│   │       └── edit/
│   │           └── page.vue             # RSC·SSR|Guard·RBAC|FSD|Async·Vue|Lookbook·UPDATE
│   │
│   ├── ── CMS COLLECTIONS ──────────────────────────────────
│   │
│   ├── cms-collection/
│   │   ├── page.vue                     # RSC·SSR|Guard|FSD|Async·Vue|Collection list
│   │   ├── new/
│   │   │   └── page.vue                 # RSC·SSR|Guard·RBAC|FSD|Async·Vue|Collection·CREATE
│   │   └── [slug]/
│   │       ├── page.vue                 # RSC·SSG·ISR|Observer|FSD|Async·Vue|Collection detail
│   │       └── edit/
│   │           └── page.vue             # RSC·SSR|Guard·RBAC|FSD|Async·Vue|Collection·UPDATE
│   │
│   ├── ── SEO SECTIONS ─────────────────────────────────────
│   │
│   ├── categories/
│   │   ├── page.vue                     # RSC·SSG|Observer|FSD|Async·Vue|SEO cat list
│   │   └── [slug]/
│   │       └── page.vue                 # RSC·SSG·ISR|Observer|FSD|Async·Vue|SEO cat page
│   │
│   ├── brands/                          # RF-05.4 landing SEO de marcas
│   │   ├── page.vue                     # SSR·ISR|Repository|FSD|Async·Vue|Marcas (premium primero)
│   │   └── [slug]/
│   │       └── page.vue                 # SSR·ISR|Repository·Adapter|FSD|Async·Vue|Landing de marca + JSON-LD Brand
│   │
│   ├── events/
│   │   ├── page.vue                     # RSC·SSG|Observer|FSD|Async·Vue|Events list
│   │   └── [slug]/
│   │       └── page.vue                 # RSC·SSG·ISR|Observer|FSD|Async·Vue|Event detail
│   │
│   ├── blog/
│   │   ├── page.vue                     # RSC·SSG|Observer|FSD|Async·Vue|Blog list
│   │   └── [slug]/
│   │       └── page.vue                 # RSC·SSG·ISR|Observer|FSD|Async·Vue|Post detail
│   │
│   ├── ── SOCIAL COMMERCE ──────────────────────────────────
│   │
│   ├── social/
│   │   ├── products/
│   │   │   ├── page.vue                 # RSC·SSR|Guard|FSD|Async·Vue|Social products
│   │   │   └── [id]/
│   │   │       └── page.vue             # RSC·SSR·ISR|Observer|FSD|Async·Vue|Product social
│   │   ├── checkout/
│   │   │   └── page.vue                 # RSC·SSR|Guard|FSD|Async·Vue|Social checkout
│   │   ├── analytics/
│   │   │   └── page.vue                 # RSC·SSR|Guard·RBAC|FSD|Async·Vue|Social analytics
│   │   └── influencers/
│   │       ├── page.vue                 # RSC·SSR|Guard·RBAC|FSD|Async·Vue|Influencer list
│   │       └── [id]/
│   │           └── page.vue             # RSC·SSR|Guard|FSD|Async·Vue|Influencer profile
│   │
│   ├── ── PWA SECTIONS ─────────────────────────────────────
│   │
│   ├── pwa/
│   │   ├── install/
│   │   │   └── page.vue                 # RSC·SSR|-|FSD|Async·Vue|PWA install
│   │   ├── offline/
│   │   │   └── page.vue                 # Client|Observer|FSD|Vue·SW|Offline page
│   │   ├── notifications/
│   │   │   └── page.vue                 # RSC·SSR|Guard|FSD|Async·Vue|Push settings
│   │   └── cache/
│   │       └── page.vue                 # RSC·SSR|Guard·RBAC|FSD|Async·Vue|Cache manage
│   │
│   ├── ── CONFIG SECTIONS ──────────────────────────────────
│   │
│   ├── config/
│   │   ├── payments/
│   │   │   └── page.vue                 # RSC·SSR|Guard·RBAC|FSD|Async·Vue|Payment config
│   │   └── shipping/
│   │       └── page.vue                 # RSC·SSR|Guard·RBAC|FSD|Async·Vue|Shipping config
│   │
│   ├── login/
│   │   └── page.vue                     # Client|Guard·BFF|FSD|Async·Vue|Panel login (JWT Express + 2FA)
│   │
│   ├── error.vue                        # Vue·TS|Observer|FSD|Vue|Error page
│   └── app.vue                          # Vue·TS|HOC|FSD|Vue|Root entry
│
├── features/                            # FSD Layer 3 — Business features
│   │
│   ├── landing/                         # Feature: Landing Pages
│   │   ├── ui/
│   │   │   ├── LeadCaptureForm.vue      # Vue·Zod·VV|Factory|FSD|Vue·Func|Lead form
│   │   │   ├── HeroSection.vue          # Vue·GSAP|Observer|FSD|Vue|Hero anim
│   │   │   ├── CountdownTimer.vue       # Vue·VueUse|Observer|FSD|Vue·Reactv|Countdown
│   │   │   └── TestimonialSlider.vue    # Vue·Swiper|Composite|FSD|Vue|Testimonials
│   │   ├── model/
│   │   │   └── landing.store.ts         # Pinia|Observer·Sing|FSD|Reactivo|Landing state
│   │   ├── api/
│   │   │   └── landing.api.ts           # $fetch·TS|Repository|FSD|Async|Landing HTTP
│   │   ├── composable/
│   │   │   └── useLanding.ts            # VueUse·GSAP|Observer|FSD|Reactivo|Anim+tracking
│   │   └── lib/
│   │       └── landing.validator.ts     # Zod·TS|Schema|FSD|Func|Schema landing
│   │
│   ├── cms/                             # Feature: CMS Pages / Lookbooks / Collections
│   │   ├── ui/
│   │   │   ├── CMSPageEditor.vue        # GrapesJS·Vue|Strategy|FSD|Vue·Func|Drag-drop editor
│   │   │   ├── CMSBlockRenderer.vue     # Vue·TS|Composite|FSD|Vue|Block render
│   │   │   ├── LookbookGrid.vue         # Vue·TS|Composite|FSD|Vue|Lookbook grid
│   │   │   ├── CollectionBanner.vue     # Vue·TS|Factory|FSD|Vue|Coll banner
│   │   │   ├── CollectionForm.vue       # Vue·Zod·VV|Adapter|FSD|Vue·Func|Collection CRUD form
│   │   │   ├── ProductPicker.vue        # Vue·TS|Observer|FSD|Vue|Product search/select
│   │   │   └── CMSPreview.vue           # Vue·TS|Observer|FSD|Vue|Live preview
│   │   ├── model/
│   │   │   └── cms.store.ts             # Pinia|Observer·Sing|FSD|Reactivo|CMS state
│   │   ├── api/
│   │   │   └── cms.api.ts               # $fetch·TS|Repository|FSD|Async|CMS HTTP
│   │   ├── composable/
│   │   │   ├── useCMSEditor.ts          # GrapesJS·Vue|Observer|FSD|Reactivo|Editor logic
│   │   │   └── useCMSBlocks.ts          # Vue·TS|Factory|FSD|Reactivo|Block factory
│   │   └── lib/
│   │       └── cms.validator.ts         # Zod·TS|Schema|FSD|Func|Schema CMS
│   │
│   ├── seo/                             # Feature: SEO Categories / Events / Blog
│   │   ├── ui/
│   │   │   ├── BlogPostCard.vue         # Vue·TS|Factory|FSD|Vue|Post card
│   │   │   ├── BlogPostContent.vue      # Nuxt-Content|Composite|FSD|Vue|MD renderer
│   │   │   ├── EventCard.vue            # Vue·TS|Factory|FSD|Vue|Event card
│   │   │   ├── CategoryBreadcrumb.vue   # Vue·TS|Composite|FSD|Vue|Breadcrumb
│   │   │   └── SchemaOrgMeta.vue        # Schema.org|Adapter|FSD|Vue|JSON-LD SEO
│   │   ├── model/
│   │   │   └── seo.store.ts             # Pinia|Observer·Sing|FSD|Reactivo|SEO state
│   │   ├── api/
│   │   │   └── seo.api.ts               # $fetch·TS|Repository|FSD|Async|SEO HTTP
│   │   ├── composable/
│   │   │   └── useSEOMeta.ts            # useHead·TS|Observer|FSD|Reactivo|Meta tags
│   │   └── lib/
│   │       └── seo.validator.ts         # Zod·TS|Schema|FSD|Func|Schema SEO
│   │
│   ├── social-commerce/                 # Feature: Social Commerce
│   │   ├── ui/
│   │   │   ├── SocialProductCard.vue    # Vue·TS|Factory|FSD|Vue|Product card
│   │   │   ├── SocialCheckoutForm.vue   # Vue·Zod·VV|Factory|FSD|Vue·Func|Social checkout
│   │   │   ├── InfluencerCard.vue       # Vue·TS|Factory|FSD|Vue|Influencer card
│   │   │   ├── SocialAnalyticsDash.vue  # Vue·SVG|Observer|FSD|Vue·Data|Social metrics
│   │   │   ├── SocialSentimentPanel.vue # Vue·TS|Observer|FSD|Async·Vue|Sentimiento y causas negativas (RF-15.11)
│   │   │   ├── SocialPublishForm.vue    # Vue·Zod·VV|Factory|FSD|Vue·Func|Multi-network publish
│   │   │   ├── (app/social/channels/page.vue) # Vue·TS|Facade·Command|FSD|Vue|RF-19.1/19.7/19.11 canales y UGC
│   │   │   ├── (app/social/live/page.vue)     # Vue·VV·Zod|Factory·State|FSD|Vue|RF-19.9 gestión Live Shopping
│   │   │   └── CommissionTracker.vue    # Vue·TS|Observer|FSD|Vue|Commission UI
│   │   ├── model/
│   │   │   └── social.store.ts          # Pinia|Observer·Sing|FSD|Reactivo|Social state
│   │   ├── api/
│   │   │   └── social.api.ts            # $fetch·TS|Repository|FSD|Async|Social HTTP
│   │   ├── composable/
│   │   │   └── useSocialCommerce.ts     # VueUse·Pinia|Observer|FSD|Reactivo|Social logic
│   │   └── lib/
│   │       └── social.validator.ts      # Zod·TS|Schema|FSD|Func|Schema social
│   │
│   ├── pwa/                             # Feature: PWA Installation / Offline / Push / Cache
│   │   ├── ui/
│   │   │   ├── InstallPrompt.vue        # Vue·PWA|Observer|FSD|Vue|Install banner
│   │   │   ├── OfflineIndicator.vue     # Vue·SW|Observer|FSD|Vue|Offline badge
│   │   │   ├── PushToggle.vue           # Vue·Push|Observer|FSD|Vue·Func|Push enable
│   │   │   ├── CacheStatus.vue          # Vue·Workbox|Observer|FSD|Vue|Cache status
│   │   │   └── UpdateBanner.vue         # Vue·SW|Observer|FSD|Vue|SW update UI
│   │   ├── model/
│   │   │   └── pwa.store.ts             # Pinia|Observer·Sing|FSD|Reactivo|PWA state
│   │   ├── api/
│   │   │   └── pwa.api.ts               # $fetch·Push|Repository|FSD|Async|Push HTTP
│   │   ├── composable/
│   │   │   ├── usePWAInstall.ts         # VueUse·PWA|Observer|FSD|Reactivo|Install logic
│   │   │   ├── usePushNotif.ts          # Push·Workbox|Observer|FSD|Reactivo|Push logic
│   │   │   └── useCacheManager.ts       # Workbox·SW|Strategy|FSD|Reactivo|Cache strategy
│   │   └── lib/
│   │       └── pwa.validator.ts         # Zod·TS|Schema|FSD|Func|Schema PWA
│   │
│   └── config/                          # Feature: Global Config (Pagos / Envío)
│       ├── ui/
│       │   ├── PaymentGatewayForm.vue   # Vue·Zod·VV|Factory|FSD|Vue·Func|Payment config
│       │   ├── ShippingCarrierForm.vue  # Vue·Zod·VV|Factory|FSD|Vue·Func|Carrier config
│       │   ├── CarrierStatsTable.vue    # Vue·TS|Observer|FSD|Async·Vue|Desempeño transportadoras (RF-10.7)
│       │   ├── TaxRatesForm.vue         # Vue·Zod·VV|Factory|FSD|Vue·Func|Tax rates form
│       │   ├── ReturnsPolicyForm.vue    # Vue·Zod·VV|Factory|FSD|Vue·Func|Política de devoluciones (RF-12.6)
│       │   ├── HelpCenterForm.vue       # Vue·Zod·VV|Factory|FSD|Vue·Func|Preguntas frecuentes (RF-21.2)
│       │   └── StoreCurrencyForm.vue    # Vue·Zod·VV|Factory|FSD|Vue·Func|Currency config
│       ├── model/
│       │   └── config.store.ts          # Pinia|Observer·Sing|FSD|Reactivo|Config state
│       ├── api/
│       │   └── config.api.ts            # $fetch·TS|Repository|FSD|Async|Config HTTP
│       ├── composable/
│       │   └── useStoreConfig.ts        # Pinia·VueUse|Observer|FSD|Reactivo|Config logic
│       └── lib/
│           └── config.validator.ts      # Zod·TS|Schema|FSD|Func|Schema config
│
├── widgets/                             # FSD Layer 4 — Composed UI blocks
│   ├── landing/
│   │   ├── LandingCard.vue              # Vue·TS|Factory|FSD|Vue|Landing card
│   │   ├── LandingHero.vue              # Vue·GSAP|Composite|FSD|Vue|Hero section
│   │   └── CountdownTimer.vue           # Vue·VueUse|Observer|FSD|Vue·Reactv|Timer widget
│   ├── cms/
│   │   ├── CMSNavigation.vue            # Vue·TS|Composite|FSD|Vue|CMS nav
│   │   └── CMSToolbar.vue               # GrapesJS·Vue|Composite|FSD|Vue|Editor toolbar
│   ├── seo/
│   │   ├── BlogSidebar.vue              # Vue·TS|Composite|FSD|Vue|Blog sidebar
│   │   └── RelatedPosts.vue             # Vue·TS|Observer|FSD|Vue|Related posts
│   ├── social/
│   │   ├── SocialFeedWidget.vue         # Vue·TS|Observer|FSD|Vue|Feed widget
│   │   └── InfluencerRanking.vue        # Vue·Charts|Observer|FSD|Vue·Data|Top influencers
│   ├── pwa/
│   │   └── PWAStatusBar.vue             # Vue·SW|Observer|FSD|Vue|PWA status bar
│   └── navigation/
│       ├── AdminHeader.vue              # Vue·Pinia|Composite|FSD|Vue|Admin header
│       ├── AdminSidebar.vue             # Vue·TS|Composite|FSD|Vue|Admin sidebar
│       └── BreadcrumbNav.vue            # Vue·TS|Composite|FSD|Vue|Breadcrumb
│
├── entities/                            # FSD Layer 5 — Business entities (pure)
│   ├── landing/
│   │   └── model/
│   │       └── landing.types.ts         # TS strict|VO|FSD|Typed|Landing types
│   ├── cms/
│   │   └── model/
│   │       └── cms.types.ts             # TS strict|VO|FSD|Typed|CMS types
│   ├── blog/
│   │   └── model/
│   │       └── blog.types.ts            # TS strict|VO|FSD|Typed|Blog types
│   ├── social/
│   │   └── model/
│   │       └── social.types.ts          # TS strict|VO|FSD|Typed|Social types
│   └── pwa/
│       └── model/
│           └── pwa.types.ts             # TS strict|VO|FSD|Typed|PWA types
│
├── shared/                              # FSD Layer 6 — Infrastructure shared
│   ├── ui/                              # Design System — Vue components
│   │   ├── Button.vue                   # Nuxt-UI·TS|Factory|FSD|Vue|Base button
│   │   ├── Input.vue                    # Nuxt-UI·VV|Factory|FSD|Vue|Base input
│   │   ├── Modal.vue                    # Nuxt-UI·TS|-|FSD|Vue|Dialog modal
│   │   ├── Toast.vue                    # Nuxt-UI·TS|Observer|FSD|Vue|Toast notify
│   │   ├── Skeleton.vue                 # Nuxt-UI·TS|-|FSD|Vue|Loading bone
│   │   ├── Badge.vue                    # Nuxt-UI·TS|Factory|FSD|Vue|Status badge
│   │   ├── DataTable.vue                # Vue·TS|Composite|FSD|Vue|Data grid
│   │   ├── Pagination.vue               # Vue·TS|-|FSD|Vue|Page control
│   │   └── EmptyState.vue               # Vue·TS|-|FSD|Vue|Empty UI
│   ├── composable/                      # VueUse-style shared composables
│   │   ├── useAuth.ts                   # Pinia·JWT|Observer|FSD|Reactivo|Auth composable
│   │   ├── useToast.ts                  # Pinia·TS|Observer|FSD|Reactivo|Toast composable
│   │   ├── useMediaQuery.ts             # VueUse·TS|Observer|FSD|Reactivo|Responsive
│   │   ├── useDebounce.ts               # VueUse·TS|-|FSD|Func|Debounce util
│   │   ├── useInfiniteScroll.ts         # VueUse·TS|Observer|FSD|Reactivo|Infinite scroll
│   │   ├── useWebSocket.ts              # WS·Pinia|Observer|FSD|Reactivo|WS composable
│   │   └── useCountdown.ts              # VueUse·TS|Observer|FSD|Reactivo|Countdown timer
│   ├── lib/
│   │   ├── api-client.ts                # $fetch·TS|Singleton|FSD|Async|HTTP client
│   │   ├── device-id.ts                 # WebCrypto·TS|Singleton|FSD|Async|Huella del dispositivo (RF-08.11)
│   │   ├── auth-config.ts               # nuxt-auth·TS|Singleton|FSD|POO|Auth config
│   │   ├── format.ts                    # Intl·dayjs|Util|FSD|Func|Format dates/$$
│   │   ├── cn.ts                        # clsx·TS|Util|FSD|Func|ClassNames util
│   │   └── analytics.ts                 # GTM·TS|Observer|FSD|Func|Track events
│   ├── types/
│   │   ├── api.types.ts                 # TS strict|VO|FSD|Typed|API response
│   │   ├── common.types.ts              # TS strict|VO|FSD|Typed|Shared types
│   │   └── nuxt.types.ts                # TS strict|VO|FSD|Typed|Nuxt types
│   └── constants/
│       ├── routes.ts                    # TS|Config|FSD|Typed|Route paths
│       └── config.ts                    # TS|Config|FSD|Typed|App constants
│
├── server/                              # Nuxt server middleware / API
│   ├── middleware/
│   │   ├── auth.ts                      # JWT·Nuxt|Guard·Proxy|FSD|Async|Silent token refresh
│   │   └── logger.ts                    # JSON·Nuxt|Observer|FSD|Async|Request log
│   ├── utils/
│   │   └── session.ts                   # h3·TS|Facade|FSD|Async|httpOnly session cookies
│   └── api/
│       ├── auth/
│       │   ├── session.post.ts          # Nitro·Zod|BFF|FSD|Async|Login (+2FA) vía Express
│       │   └── session.delete.ts        # Nitro·TS|BFF|FSD|Async|Logout (revoca sesión)
│       └── webhooks/
│           └── [provider].ts            # Nuxt·HMAC|Handler·Strategy|FSD|Async|cms.updated => purga ISR
│
├── plugins/                             # Nuxt plugins (auto-imported)
│   ├── pinia.ts                         # Pinia·Nuxt|Singleton|FSD|POO|State plugin
│   ├── vee-validate.ts                  # VV·Nuxt|Decorator|FSD|Func|Forms plugin
│   └── analytics.client.ts              # GTM·Nuxt|Observer|FSD|Func|Analytics (CSR)
│
├── layouts/                             # Nuxt layouts
│   ├── default.vue                      # Vue·TS|HOC|FSD|Vue|Default layout
│   ├── admin.vue                        # Vue·Pinia|Guard·HOC|FSD|Vue|Admin layout
│   ├── landing.vue                      # Vue·GSAP|HOC|FSD|Vue|Landing layout
│   ├── cms.vue                          # GrapesJS·Vue|HOC|FSD|Vue|CMS editor layout
│   └── blank.vue                        # Vue·TS|-|FSD|Vue|Blank (PWA)
│
├── middleware/                          # Nuxt route middleware
│   ├── auth.ts                          # Pinia·JWT|Guard|FSD|Async|Route protect
│   ├── rbac.ts                          # Pinia·RBAC|Guard|FSD|Async|Role check
│   └── analytics.ts                     # GTM·Nuxt|Observer|FSD|Func|Page tracking
│
├── public/                              # Static assets
│   ├── icons/                           # SVG icons (WCAG accessible)
│   ├── images/                          # Static images
│   ├── fonts/                           # Local fonts
│   └── manifest.webmanifest             # PWA·Workbox|Config|FSD|-|PWA manifest
│
├── content/                             # Nuxt Content v2 — MDC files
│   ├── blog/                            # Nuxt-Content|-|FSD|-|Blog MDX posts
│   ├── pages/                           # Nuxt-Content|-|FSD|-|Static pages
│   └── docs/                            # Nuxt-Content|-|FSD|-|Documentation
│
├── i18n/                                # Translations (@nuxtjs/i18n)
│   ├── es.json                          # nuxt-i18n|i18n|FSD|-|Spanish
│   └── en.json                          # nuxt-i18n|i18n|FSD|-|English
│
├── sw/                                  # Service Worker (Workbox)
│   ├── sw.ts                            # Workbox·SW|Strategy|FSD|SW·Async|SW entry
│   ├── outbox.ts                        # Workbox BG Sync|Command·Observer|FSD|SW·Async|RF-28.4 cola sin conexión · RF-28.7 reintentos
│   ├── cache-strategies.ts              # Workbox·TS|Strategy|FSD|SW·Func|Cache rules
│   └── push-handler.ts                  # Push·Workbox|Observer|FSD|SW·Async|Push handler
│
├── .env                                 # -|Config|-|-|Env variables
├── .env.example                         # -|Config|-|-|Env template
├── nuxt.config.ts                       # Nuxt·TS|Config|-|-|Nuxt config
├── content.config.ts                    # Nuxt-Content·Zod|Schema|-|-|Blog/pages/docs collections
├── tailwind.config.ts                   # Tailwind·TS|Config|-|-|CSS config
├── tsconfig.json                        # TS strict|Config|-|-|TS config
└── package.json                         # pnpm·TS|Config|-|-|Dependencies
```

---

## ABREVIATURAS

| Abr.        | Significado                               |
|-------------|-------------------------------------------|
| FSD         | Feature-Sliced Design                     |
| RSC         | Rendizado del Servidor (SSR + SSG en Nuxt)|
| SSR         | Server-Side Rendering                     |
| SSG         | Static Site Generation                    |
| ISR         | Incremental Static Regeneration           |
| HOC         | Higher Order Component                    |
| Guard       | Route / auth guard                        |
| RBAC        | Role-Based Access Control                 |
| Observer    | Observer / Reactive Pattern               |
| Factory     | Factory Pattern                           |
| Composite   | Composite / Container Pattern             |
| Strategy    | Strategy Pattern                          |
| Sing        | Singleton Pattern                         |
| Adapter     | Adapter Pattern                           |
| Facade      | Facade Pattern                            |
| VO          | Value Object                              |
| Reactivo    | Reactive Programming (Pinia + VueUse)     |
| Func        | Functional Programming                    |
| Typed       | Strongly Typed (TypeScript strict)        |
| Data        | Data-Driven                               |
| SW          | Service Worker                            |
| PWA         | Progressive Web App                       |
| VV          | Vee-Validate                             |
| GrapesJS    | Drag-and-drop page builder                |
| Workbox     | Google Workbox (PWA cache strategies)     |
| GTM         | Google Tag Manager                        |
| i18n        | Internationalization                      |
| a11y        | Accessibility (WCAG 2.1 AA)               |
| WCAG        | Web Content Accessibility Guidelines      |
| MDC         | Markdown Components (Nuxt Content v2)     |
| CSR         | Client-Side Rendering                     |
| WS          | WebSocket                                 |
| Push        | Web Push API                              |
| GSAP        | GreenSock Animation Platform             |

---

## ESTADO DE IMPLEMENTACIÓN — v35 (Fase 8, 05/10/2026)

| Tema | Spec | v35 (implementado) |
|------|------|--------------------|
| Backend del CMS | — | Módulo Express `cms` (MongoDB): páginas, landings + leads, lookbooks, eventos y configuración de tienda |
| Blog | Nuxt Content v2 | Nuxt Content v3 (`content.config.ts`, SQLite nativo de Node 22: sin compilar better-sqlite3) |
| Estado | Pinia | Pinia (Client State) + `useAsyncData` (Server State); `$fetch` en lugar de Axios/Apollo (0 KB extra) |
| Formularios | Vee-Validate + Zod | Vee-Validate + `@vee-validate/zod`; `shared/ui/Input.vue` se conecta por `name` (useField) |
| Animaciones | GSAP | Web Animations API + IntersectionObserver (`useLanding.ts`), respeta "reducir movimiento" |
| Gráficos | Vue Charts / Chart.js | SVG propio + tabla accesible (`SocialAnalyticsDash.vue`, `InfluencerRanking.vue`) |
| Carrusel | Swiper | CSS scroll-snap (`TestimonialSlider.vue`) |
| SEO | nuxt-seo | `useSeoMeta` + JSON-LD propio (`useSEOMeta.ts`, `SchemaOrgMeta.vue`, `CategoryBreadcrumb.vue`) |
| PWA | Workbox | `@vite-pwa/nuxt` (injectManifest) + `sw/` con Workbox; Web Push estándar (VAPID) enviado por Express |
| Editor | GrapesJS | GrapesJS con import dinámico (solo en el editor); el HTML se dibuja en SSR en las páginas públicas |
| Auth | nuxt-auth | Misma sesión JWT de Express vía Nitro (refresh token en cookie httpOnly; renovación en `server/middleware/auth.ts`) |

**RF 01–05 (10/10/2026):** tienda con insignias de producto (`ProductCard.vue`) y filtro `?badge=` en `/products`; landing SEO de marcas `/brands` y `/brands/[slug]` (logo, premium/exclusiva, país, historia, productos, JSON-LD Brand, ISR 1 h; la marca de la ficha enlaza allí); colecciones con descuento por look completo (`CollectionForm.vue` + aviso en `CollectionBanner.vue`). Menú lateral del panel más compacto y regla de rol igual a Next (VENDOR ve todo ítem sin `adminOnly`; `panelHome()` en `usePanelNav.ts`).

Rutas: el árbol usa `carpeta/page.vue`; `nuxt.config.ts` toma solo esos archivos como rutas (hook `pages:extend`). Públicas con ISR (1 h; blog 24 h) y peticiones ANÓNIMAS (la caché es compartida); panel y editores solo en el navegador (`ssr: false`). Archivos agregados respecto al árbol: `app/login/page.vue`, `server/api/auth/*`, `server/utils/session.ts`, `features/cms/ui/CollectionForm.vue`, `features/cms/ui/ProductPicker.vue`, `features/social-commerce/ui/SocialPublishForm.vue` y `content.config.ts`. Tienda RF 06–10: `features/search/ui/StoreSearch.vue` (autocompletado, voz, QR e imagen), `app/search/page.vue` (búsqueda por foto con atributos visuales), `features/cart/model/attribution.ts` (canal de origen del pedido). Los formularios de landings y eventos reutilizan `CMSPageEditor.vue` (kind = page | landing | event | lookbook). Tienda RF 11–15: `features/product/ui/ProductReviews.vue` (aspectos, galería, útil, historial y reseña con fotos) y `features/product/ui/ProductPromo.vue` (contador de oferta flash, preventa por nivel y compartir con puntos). Tienda RF 16–20: `features/store/ui/ForYou.vue` (portada personalizada por historial, hora, ubicación y dispositivo), `app/live/page.vue` y `app/live/[id]/page.vue` (Live Shopping con producto fijado) y `features/product/ui/ProductUgc.vue` (fotos y videos de clientes); panel: `app/social/channels/page.vue` y `app/social/live/page.vue`. Tienda RF 21–25: `app/help/page.vue` (centro de ayuda con buscador y JSON-LD FAQPage), `app/contact/page.vue` (formulario de contacto con honeypot), `features/store/lib/help.validator.ts` y `shared/lib/vitals.ts` (Web Vitals y clics para el mapa de calor, RF-24.8). Tienda RF 26–30: `sw/outbox.ts` (Background Sync: carrito, reseñas, contacto y UGC hechos sin conexión se reenvían al volver la red), `Idempotency-Key` en `shared/lib/api-client.ts` (Express no duplica el reintento) y `OfflineIndicator.vue` con acciones pendientes/sincronizadas.

Verificación: `nuxt typecheck` (vue-tsc) y ESLint sin errores. En este equipo `nuxt dev` falla con "Package import specifier #vite-node is not defined" porque la ruta del proyecto + los nombres de `node_modules/.pnpm` superan 260 caracteres (MAX_PATH de Windows); se resuelve moviendo el repositorio a una ruta corta (ej. `C:\dev\ecommerce-web3-enterprise`) o con pnpm ≥ 9.1 y `virtual-store-dir-max-length=60` en `.npmrc` (reinstalación completa).
