# 📋 PROYECTO eCOMMERCE WEB3 ENTERPRISE
## ESPECIFICACIÓN TÉCNICA UNIFICADA

---

## 🌐 VISIÓN GENERAL

### Descripción del Proyecto

Plataforma de comercio electrónico de próxima generación que combina lo mejor de Web2 y Web3, construida sobre una arquitectura de microservicios heterogéneos y microfrontends independientes. Esta solución enterprise está diseñada para escalar sin límites, integrando nativamente capacidades blockchain, inteligencia artificial avanzada distribuida y comercio social omnicanal.

El sistema representa una evolución natural del eCommerce tradicional hacia un ecosistema descentralizado e inteligente, donde usuarios pueden comprar con criptomonedas, obtener NFTs de fidelidad con utilidad real, interactuar con un personal shopper impulsado por IA local (sin costos recurrentes), y realizar compras directamente desde redes sociales sin abandonar la plataforma donde descubrieron el producto.

### Diferenciadores Clave

- **Web3 Nativo**: No es una integración posterior, sino arquitectura diseñada desde cero para blockchain
- **IA Local**: LangChain + Ollama eliminan dependencias de APIs externas costosas
- **Social Commerce Real**: Compra nativa en Instagram, TikTok y Facebook con inventario unificado
- **Multi-lenguaje Backend**: Express, FastAPI y Rust especializados por dominio
- **API Híbrida**: REST + RESTful + GraphQL para máxima flexibilidad y compatibilidad enterprise

### Alcance Modular Definitivo

| Componente              | Cantidad | Detalle                             |
|-------------------------|----------|-------------------------------------|
| Módulos Frontend        | 49       | 32 Next.js + 17 Nuxt.js             |
| Módulos Backend         | 54       | 37 Express + 11 FastAPI + 6 Rust    |
| **Total Módulos**       | **103**  | **Sistema completo (hojas de la matriz)** |
| Funcionalidades Activas | 413      | Enterprise-ready                    |

> ⚠️ **Principio arquitectónico**: Web3, IA y Social Commerce son capacidades transversales integradas, no módulos adicionales. El sistema tiene 103 módulos, los mismos que registra la matriz (`ecommerce_matriz_trazabilidad_v34.xlsx`).

---

## 🏗️ ARQUITECTURA GENERAL DEL SISTEMA

### Arquitectura Seleccionada (OFICIAL)

**Domain-Oriented Modular Architecture (DOMA)**

#### ¿Por Qué DOMA y No Clean/Hexagonal?

| Arquitectura       | Ventajas                           | Desventajas en este Proyecto        |
|--------------------|------------------------------------|-------------------------------------|
| Clean Architecture | Desacoplamiento extremo            | Demasiadas capas = desarrollo lento |
| Hexagonal          | Puertos y adaptadores flexibles    | Complejidad innecesaria para microservicios |
| **DOMA ✅**        | Simple, pragmática, MVC-friendly   | Ninguna                             |

#### Justificación DOMA

- ✅ Más simple y pragmática que Clean Architecture
- ✅ Más práctica que Hexagonal pura
- ✅ Ideal para microservicios heterogéneos (Express + FastAPI + Rust)
- ✅ Compatible con MVC clásico reforzado
- ✅ Fácil de mantener, versionar y escalar
- ✅ Permite integrar IA, Web3 y Social Commerce sin romper el MVP
- ✅ Estructura familiar para desarrolladores de cualquier nivel

### Principios Arquitectónicos Fundamentales

1. **Modularidad por Dominio** — Cada microservicio/microfrontend es autónomo
2. **MVC Clásico Reforzado** — Controller → Service → Repository
3. **Separación Clara** — Frontend / Backend / IA son capas independientes
4. **Event-Driven Communication** — Message broker para eventos asíncronos
5. **Web3 como Capa Transversal** — No es módulo, es capacidad integrada
6. **IA Desacoplada como Servicio** — Cognitivo sin aumentar módulos

### Diagrama de Capas del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTES                                  │
│         Browser · iOS · Android · PWA · Smart TV                │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTPS / WSS
┌─────────────────────▼───────────────────────────────────────────┐
│                   API GATEWAY / CDN                              │
│         CloudFlare · Load Balancer · WAF · Rate Limit           │
└──────┬──────────────┬──────────────────────┬────────────────────┘
       │              │                      │
┌──────▼──────┐ ┌─────▼──────┐      ┌───────▼──────┐
│  Next.js 15 │ │  Nuxt.js 3 │      │  Express TS  │
│  32 módulos │ │ 17 módulos │      │  37 módulos  │
│  SSR·RSC   │ │  SSG·PWA·  │      │  REST+GQL+WS │
│  App Router │ │  CMS·SEO   │      │  N-Layer     │
└─────────────┘ └────────────┘      └──────┬───────┘
                                           │
                               ┌───────────▼──────────┐
                               │       FastAPI        │
                               │     11 módulos ML    │
                               │  XGBoost·BERT·CLIP   │
                               │  TensorFlow·LangChain│
                               └───────────┬──────────┘
                                           │
                               ┌───────────▼──────────┐
                               │      Rust Axum       │
                               │      6 módulos HPC   │
                               │  <10ms · DashMap     │
                               │  WebSocket·Blockchain│
                               └──────────────────────┘
```

---

## 🔧 STACK TECNOLÓGICO COMPLETO

### Frontend

#### 📱 Next.js 15 — Storefront & Admin (32 módulos)

| Categoría        | Tecnología                                           |
|------------------|------------------------------------------------------|
| Framework        | Next.js 15 · App Router · React 19                  |
| Rendering        | RSC · SSR · SSG · ISR · Streaming                   |
| State Management | TanStack Query v5 (Server State) · Redux Toolkit (Client State) · React Context |
| HTTP / API       | Axios (REST) · Apollo Client (GraphQL)              |
| UI / Styling     | Tailwind CSS · shadcn/ui · Radix UI · Framer Motion |
| Forms            | Formik · Zod                                        |
| Auth             | next-auth v5 · JWT · OAuth2 · SIWE (EIP-1193)        |
| Payments         | Stripe Elements (PSP exclusivo)                     |
| i18n             | next-intl · ICU format                              |
| Performance      | next/image (WebP+AVIF) · next/font · Bundle Analyzer|
| Testing          | Jest · Playwright · Testing Library                 |
| Tipado           | TypeScript 5 strict · ES2022+                       |

#### 🛠️ Nuxt.js 3 — CMS, Landing & PWA (17 módulos)

| Categoría        | Tecnología                                           |
|------------------|------------------------------------------------------|
| Framework        | Nuxt.js 3 · Composition API · Vue 3 · Vite          |
| State            | Pinia · VueUse composables                           |
| Forms            | Vee-Validate · Zod                                   |
| CMS              | Nuxt Content v2 · GrapesJS drag-and-drop             |
| PWA              | Workbox · Service Worker · Push API                  |
| SEO              | nuxt-seo · sitemap · robots.txt · Schema.org         |
| UI               | Nuxt UI · Tailwind CSS · GSAP animations             |
| i18n             | @nuxtjs/i18n                                         |
| Tipado           | TypeScript 5 strict · ES2022+                        |

### Backend

#### ⚙️ Express TypeScript — Core Commerce (37 módulos)

| Categoría        | Tecnología                                           |
|------------------|------------------------------------------------------|
| Framework        | Express 4 · TypeScript strict                        |
| ORM / DB         | Prisma ORM · PostgreSQL · MongoDB · Redis            |
| Auth             | JWT · bcrypt · OAuth2 · Passport.js · SIWE (ethers)  |
| Validación       | Zod · TypeScript strict                              |
| API              | REST · RESTful · GraphQL Apollo Server · Socket.io   |
| IA               | LangChain · LangGraph · Ollama · FAISS               |
| Integración      | Stripe · Cloudinary · Nodemailer · n8n              |
| Web3             | ethers.js v6 · IPFS (Kubo RPC) · Polygon/Ethereum    |
| Infra            | Docker · Redis · Bull Queue · MCP SDK                |
| Docs             | OpenAPI 3.0 generado desde rutas · Swagger UI        |

#### 🤖 FastAPI Python — AI Engine (11 módulos)

| Categoría        | Tecnología                                           |
|------------------|------------------------------------------------------|
| Framework        | FastAPI · Uvicorn · Python 3.12+                    |
| ML / AI          | TensorFlow 2.x · XGBoost · Prophet · scikit-learn     |
| Computer Vision  | ResNet-50 · CLIP ViT-B/32 (KerasHub) · tf.image · PIL |
| NLP              | BERT · Transformers · Ollama · Llama3 (local LLM)   |
| DB               | SQLAlchemy 2.0 Async · PostgreSQL · pgvector (HNSW) |
| Validación       | Pydantic v2                                          |
| MLOps            | MLflow · Celery · Redis broker · Pandas · NumPy      |
| Búsqueda         | FAISS · cosine similarity · ANN                      |

#### 🦀 Rust Axum — High Performance (6 módulos)

| Categoría        | Tecnología                                           |
|------------------|------------------------------------------------------|
| Framework        | Axum · Tokio async runtime                           |
| DB               | SeaORM · PostgreSQL · pgvector                       |
| Cache            | DashMap (lock-free concurrent) · Redis               |
| Web3             | alloy (ethers-rs deprecado)                          |
| Resiliencia      | Circuit Breaker · Tower middleware                   |
| Serialización    | Serde JSON · Serde CBOR                              |
| Performance      | <10ms latency target · HTAP workloads               |

### Infraestructura

| Categoría        | Tecnología                                           |
|------------------|------------------------------------------------------|
| Contenedores     | Docker · Docker Compose · Kubernetes                 |
| CI/CD            | GitHub Actions · multi-stage pipelines               |
| CDN / Seguridad  | CloudFlare CDN · WAF · DDoS protection               |
| Despliegue FE    | Vercel (Next.js) · Netlify (Nuxt.js)                 |
| Monitoreo        | Grafana · Prometheus · OpenTelemetry                 |
| Logs             | Winston · Pino · Loguru (Python) · tracing (Rust)   |
| Secrets          | Vault · GitHub Secrets · .env por entorno            |

---

## 🪝 HOOKS DEL PROYECTO

Reglas de estado (TanStack Query + Redux Toolkit): `04_NEXTJS15.md`, sección **🧭 GESTIÓN DE ESTADO**.

### ⚛️ Hooks de React — Next.js 15

Inventario generado del código de apps/ecommerce-next (análisis del AST de TypeScript, 03/10/2026). Server State = datos del backend (TanStack Query); Client State = estado global de UI (Redux Toolkit); estado local = useState. Los hooks marcados "Planificado" pertenecen a fases futuras y siguen el mismo patrón.

| Hook | Categoría | Origen | Estado | Para qué | Dónde se usa | Situación |
|---|---|---|---|---|---|---|
| `useCallback` | React (núcleo) | react | Rendimiento | Memoriza funciones (suscripción de media queries) | shared/hook/useMediaQuery.ts | En uso |
| `useEffect` | React (núcleo) | react | Efecto | Sincroniza con sistemas externos: analítica, persistencia, WebSocket, confirmar pedido al montar | 12 archivos en: app, features/auth, features/checkout, features/notification, features/payment, features/product, features/search, features/settings, shared/hook | En uso |
| `useId` | React (núcleo) | react | Accesibilidad | IDs estables para label/aria-describedby (WCAG) | features/review/ui/StarRating.tsx<br>features/search/ui/SearchBar.tsx<br>features/settings/ui/LanguageSwitcher.tsx<br>shared/ui/Input.tsx | En uso |
| `useMemo` | React (núcleo) | react | Rendimiento | Memoriza valores derivados (filtros, acciones enlazadas de Redux) | features/product/ui/ProductVariants.tsx<br>features/search/ui/SearchBar.tsx<br>shared/lib/store.ts | En uso |
| `useRef` | React (núcleo) | react | Estado local | Referencias al DOM y banderas que no re-renderizan (enviar una sola vez) | features/auth/ui/VerifyEmailForm.tsx<br>features/checkout/ui/ConfirmButton.tsx<br>features/payment/ui/StripePayment.tsx<br>shared/hook/useIntersection.ts<br>shared/hook/useWebSocket.ts<br>widgets/product/ProductCarousel.tsx | En uso |
| `useState` | React (núcleo) | react | Estado local | Estado local de un componente (abrir/cerrar, valores temporales) | 14 archivos en: app, app/(account), features/checkout, features/notification, features/order, features/payment, features/product, features/search, features/settings, shared/hook, widgets/navigation | En uso |
| `useSyncExternalStore` | React (núcleo) | react | Estado externo | Lee matchMedia del navegador sin desajustes de hidratación | shared/hook/useMediaQuery.ts | En uso |
| `useTransition` | React (núcleo) | react | Rendimiento | Navegaciones/filtros sin bloquear la UI (cambio de idioma, filtros de catálogo) | features/product/ui/ProductFilters.tsx<br>features/settings/ui/LanguageSwitcher.tsx | En uso |
| `useMutation` | TanStack Query | @tanstack/react-query | Server State | Escrituras (POST/PATCH/DELETE) + invalidación de las queries relacionadas | 19 archivos en: app/(account), entities/cart, entities/user, features/auth, features/cart, features/checkout, features/loyalty, features/notification, features/order, features/payment, features/review, features/search, features/settings | En uso |
| `useQuery` | TanStack Query | @tanstack/react-query | Server State | Lecturas del backend con caché, refetch, paginación y reintentos | 10 archivos en: entities/cart, entities/user, features/checkout, features/loyalty, features/notification, features/order, features/payment, features/review, features/search, features/settings | En uso |
| `useQueryClient` | TanStack Query | @tanstack/react-query | Server State | Invalidar o actualizar en caché solo las queries afectadas tras una mutación | 13 archivos en: app/(account), entities/cart, entities/user, features/cart, features/checkout, features/loyalty, features/notification, features/order, features/review, features/search, features/settings | En uso |
| `useDispatch` | Redux Toolkit (react-redux) | react-redux | Client State | Despacha acciones del slice (encapsulado en createSliceHook) | shared/lib/store.ts | En uso |
| `useSelector` | Redux Toolkit (react-redux) | react-redux | Client State | Lee un slice del store (encapsulado en createSliceHook) | shared/lib/store.ts | En uso |
| `useFormik` | Formik | formik | Formulario | Estado del formulario (valores, touched, envío); encapsulado en useZodForm | shared/hook/useZodForm.ts | En uso |
| `useMutation (Apollo)` | Apollo Client (GraphQL) | @apollo/client/react | Server State | Mutations GraphQL (importado como useGraphqlMutation para no chocar con TanStack) | features/review/api/review.api.ts | En uso |
| `useSubscription` | Apollo Client (GraphQL) | @apollo/client/react | Server State (tiempo real) | GraphQL Subscriptions por WebSocket (graphql-ws) | shared/hook/useWebSocket.ts | En uso |
| `useSession` | next-auth | next-auth/react | Sesión | Sesión autenticada (cookie httpOnly); encapsulado en useAuth | shared/hook/useAuth.ts<br>widgets/auth/AuthBanner.tsx | En uso |
| `useFormatter` | next-intl | next-intl | i18n | Formato de fechas y números según el idioma | features/loyalty/ui/LoyaltyTiers.tsx<br>features/loyalty/ui/PointsBalance.tsx<br>features/loyalty/ui/RewardsHistory.tsx | En uso |
| `useLocale` | next-intl | next-intl | i18n | Idioma activo (es/en) | 9 archivos en: app/(commerce), features/auth, features/payment, features/settings, shared/hook, widgets/auth | En uso |
| `useTranslations` | next-intl | next-intl | i18n | Textos traducidos ES/EN | 78 archivos en: app, app/(account), app/(commerce), app/(storefront), entities/product, entities/user, features/auth, features/cart, features/checkout, features/loyalty, features/notification, features/order, features/payment, features/product, features/review, features/search, features/settings, shared/hook, shared/ui, widgets/auth, widgets/loyalty, widgets/navigation, widgets/product | En uso |
| `usePathname` | next-intl navigation (Next.js) | @/shared/lib/i18n/navigation | Navegación | Ruta actual sin prefijo de idioma (menús activos, cambio de idioma) | 7 archivos en: app/(account), features/product, features/search, features/settings, widgets/auth | En uso |
| `useRouter` | next-intl navigation (Next.js) | @/shared/lib/i18n/navigation | Navegación | Navegación que conserva el prefijo de idioma (/en) | 11 archivos en: features/auth, features/checkout, features/product, features/search, features/settings | En uso |
| `useSearchParams` | Next.js | next/navigation | Navegación | Filtros y callbackUrl en la query string | features/auth/ui/LoginForm.tsx<br>features/auth/ui/OAuthButtons.tsx<br>features/product/ui/ProductFilters.tsx<br>features/search/ui/SearchFilters.tsx<br>features/search/ui/SearchResults.tsx<br>features/settings/ui/LanguageSwitcher.tsx | En uso |
| `useElements` | Stripe | @stripe/react-stripe-js | Pagos | Elements (iframe PCI) del formulario de tarjeta | features/payment/ui/StripePayment.tsx | En uso |
| `useStripe` | Stripe | @stripe/react-stripe-js | Pagos | Instancia de Stripe para confirmar el pago (3-D Secure) | features/payment/ui/StripePayment.tsx | En uso |
| `useAuth` | Proyecto — hook compartido (shared) | shared/hook/useAuth.ts | Sesión | Acceso tipado a la sesión: usuario, token del backend y estado. | 22 archivos en: app/(account), entities/cart, entities/user, features/cart, features/checkout, features/loyalty, features/notification, features/order, features/payment, features/product, features/review, features/search, features/settings, widgets/auth, widgets/loyalty | En uso |
| `useDebounce` | Proyecto — hook compartido (shared) | shared/hook/useDebounce.ts | UI | Retrasa la propagación de un valor hasta que deja de cambiar "delay" ms. | features/search/ui/SearchBar.tsx | En uso |
| `useErrorMessage` | Proyecto — hook compartido (shared) | shared/hook/useErrorMessage.ts | UI | Mensaje de error en el idioma del usuario. Los errores del backend traen un "code" estable | 21 archivos en: app/(account), app/(commerce), features/auth, features/cart, features/checkout, features/loyalty, features/order, features/payment, features/product, features/review, features/search, features/settings | En uso |
| `useFormat` | Proyecto — hook compartido (shared) | shared/hook/useFormat.ts | UI | Formateadores ligados al idioma actual (next-intl useLocale). Funciona en Client Components y en | 17 archivos en: features/cart, features/checkout, features/loyalty, features/notification, features/order, features/payment, features/product, features/review, features/search, widgets/loyalty | En uso |
| `useIntersection` | Proyecto — hook compartido (shared) | shared/hook/useIntersection.ts | UI | ¿el elemento es visible en el viewport? | — | Definido, sin uso todavía |
| `useIsDesktop` | Proyecto — hook compartido (shared) | shared/hook/useMediaQuery.ts | UI | Suscripción a una media query CSS. | — | Definido, sin uso todavía |
| `useMediaQuery` | Proyecto — hook compartido (shared) | shared/hook/useMediaQuery.ts | UI | Suscripción a una media query CSS. | shared/hook/useMediaQuery.ts | En uso |
| `useWebSocket` | Proyecto — hook compartido (shared) | shared/hook/useWebSocket.ts | Server State (tiempo real) | GraphQL Subscription por WebSocket, autenticada con el access | features/notification/ui/NotificationBell.tsx | En uso |
| `useZodForm` | Proyecto — hook compartido (shared) | shared/hook/useZodForm.ts | Formulario | Formularios con Formik (estado: valores, "touched", envío) + Zod (reglas y tipos). Un solo hook | 11 archivos en: features/auth, features/cart, features/checkout, features/order, features/payment, features/review, features/settings | En uso |
| `useCartMutation` | Proyecto — Server State (TanStack Query) | entities/cart/api/cart.api.ts | Server State | Escritura (useMutation). Fábrica de mutaciones del carrito: cada respuesta trae el carrito COMPLETO actualizado, | features/cart/api/cart.api.ts<br>features/product/ui/AddToCartButton.tsx | En uso |
| `useCartQuery` | Proyecto — Server State (TanStack Query) | entities/cart/api/cart.api.ts | Server State | Lectura (useQuery). Carrito del usuario autenticado (deshabilitado sin sesión) | app/[locale]/(commerce)/cart/CartView.tsx<br>features/cart/ui/CartBadge.tsx<br>features/cart/ui/CartDrawer.tsx<br>widgets/cart/MiniCart.tsx | En uso |
| `useProfile` | Proyecto — Server State (TanStack Query) | entities/user/api/user.api.ts | Server State | Lectura (useQuery). Perfil completo con direcciones (Account hub y paso de dirección del checkout) | app/[locale]/(account)/account/AccountOverview.tsx<br>app/[locale]/(account)/account/addresses/AddressBook.tsx<br>features/checkout/ui/AddressForm.tsx<br>features/settings/ui/ProfileSettings.tsx<br>features/settings/ui/SecuritySettings.tsx | En uso |
| `useWishlist` | Proyecto — Server State (TanStack Query) | entities/user/api/user.api.ts | Server State | Lectura + escritura. Lista de deseos + mutaciones que actualizan la cache con la lista devuelta | app/[locale]/(account)/account/wishlist/WishlistView.tsx<br>features/product/ui/AddToCartButton.tsx | En uso |
| `useClearCart` | Proyecto — Server State (TanStack Query) | features/cart/api/cart.api.ts | Server State | Escritura (useMutation). Casos de uso de la UI del carrito construidos sobre la entidad (entities/cart/api) | — | Definido, sin uso todavía |
| `useRemoveItem` | Proyecto — Server State (TanStack Query) | features/cart/api/cart.api.ts | Server State | Escritura (useMutation). Casos de uso de la UI del carrito construidos sobre la entidad (entities/cart/api) | features/cart/ui/CartItem.tsx | En uso |
| `useUpdateQuantity` | Proyecto — Server State (TanStack Query) | features/cart/api/cart.api.ts | Server State | Escritura (useMutation). ACTUALIZACIÓN OPTIMISTA: la UI refleja la nueva cantidad al instante y se revierte si falla | features/cart/ui/CartItem.tsx | En uso |
| `useValidateCoupon` | Proyecto — Server State (TanStack Query) | features/cart/api/cart.api.ts | Server State | Escritura (useMutation). Vista previa del descuento antes de iniciar el checkout | features/cart/ui/CartSummary.tsx | En uso |
| `useAbandonCheckout` | Proyecto — Server State (TanStack Query) | features/checkout/api/checkout.api.ts | Server State | Escritura (useMutation). Saga de checkout desde el cliente: iniciar, consultar, fijar dirección/envío, abandonar, | — | Definido, sin uso todavía |
| `useCheckout` | Proyecto — Server State (TanStack Query) | features/checkout/api/checkout.api.ts | Server State | Lectura (useQuery). Saga de checkout desde el cliente: iniciar, consultar, fijar dirección/envío, abandonar, | app/[locale]/(commerce)/checkout/[id]/CheckoutStepView.tsx | En uso |
| `useInitCheckout` | Proyecto — Server State (TanStack Query) | features/checkout/api/checkout.api.ts | Server State | Escritura (useMutation). POST /checkout (reserva stock); invalida el carrito (sus ítems quedan "congelados" en la sesión) | features/checkout/ui/ConfirmButton.tsx | En uso |
| `usePlaceOrder` | Proyecto — Server State (TanStack Query) | features/checkout/api/checkout.api.ts | Server State | Escritura (useMutation). POST /order: es una escritura, por eso useMutation (no useQuery). | features/checkout/ui/ConfirmButton.tsx | En uso |
| `useShippingRates` | Proyecto — Server State (TanStack Query) | features/checkout/api/checkout.api.ts | Server State | Lectura (useQuery). Cotización en vivo para la dirección seleccionada (peso y subtotal del checkout) | features/checkout/ui/AddressForm.tsx | En uso |
| `useUpdateCheckoutAddress` | Proyecto — Server State (TanStack Query) | features/checkout/api/checkout.api.ts | Server State | Escritura (useMutation). PATCH /checkout/:id/address (dirección + tarifa + cupón opcional) | features/checkout/ui/AddressForm.tsx | En uso |
| `useBadges` | Proyecto — Server State (TanStack Query) | features/loyalty/api/loyalty.api.ts | Server State | Lectura (useQuery). Cuenta de fidelidad (saldo, nivel, historial) e insignias NFT (listar y mintear). | features/loyalty/ui/NFTBadgeGallery.tsx | En uso |
| `useLoyaltyAccount` | Proyecto — Server State (TanStack Query) | features/loyalty/api/loyalty.api.ts | Server State | Lectura (useQuery). Cuenta de fidelidad (saldo, nivel, historial) e insignias NFT (listar y mintear). | features/loyalty/ui/LoyaltyTiers.tsx<br>features/loyalty/ui/NFTBadgeGallery.tsx<br>features/loyalty/ui/PointsBalance.tsx<br>features/loyalty/ui/RewardsHistory.tsx<br>widgets/loyalty/PointsBanner.tsx | En uso |
| `useMintBadge` | Proyecto — Server State (TanStack Query) | features/loyalty/api/loyalty.api.ts | Server State | Escritura (useMutation). POST /loyalty/:id/badge/mint (requiere wallet vinculada; la transacción tarda unos segundos) | features/loyalty/ui/NFTBadgeGallery.tsx | En uso |
| `useNotificationActions` | Proyecto — Server State (TanStack Query) | features/notification/api/notification.api.ts | Server State | Escritura (useMutation). Marcar leída(s) y borrar; invalidan bandeja y conteo (["notifications"] cubre ambos) | features/notification/ui/NotificationList.tsx | En uso |
| `useNotifications` | Proyecto — Server State (TanStack Query) | features/notification/api/notification.api.ts | Server State | Lectura (useQuery). Bandeja de notificaciones, conteo de no leídas y preferencias por canal (REST con Axios) | features/notification/ui/NotificationList.tsx | En uso |
| `useUnreadCount` | Proyecto — Server State (TanStack Query) | features/notification/api/notification.api.ts | Server State | Lectura (useQuery). Bandeja de notificaciones, conteo de no leídas y preferencias por canal (REST con Axios) | features/notification/ui/NotificationBell.tsx | En uso |
| `useCancelOrder` | Proyecto — Server State (TanStack Query) | features/order/api/order.api.ts | Server State | Escritura (useMutation). DELETE /order/:id (solo antes del envío; el backend reembolsa automáticamente) | features/order/ui/OrderDetail.tsx | En uso |
| `useOrder` | Proyecto — Server State (TanStack Query) | features/order/api/order.api.ts | Server State | Lectura (useQuery). Pedidos del usuario (lista/detalle), cancelación, devoluciones y descarga de factura. | features/order/ui/OrderDetail.tsx | En uso |
| `useOrders` | Proyecto — Server State (TanStack Query) | features/order/api/order.api.ts | Server State | Lectura (useQuery). Pedidos del usuario (lista/detalle), cancelación, devoluciones y descarga de factura. | features/order/ui/OrderList.tsx | En uso |
| `useRequestRefund` | Proyecto — Server State (TanStack Query) | features/order/api/order.api.ts | Server State | Escritura (useMutation). POST /refund (devolución de un pedido entregado) | features/order/ui/OrderDetail.tsx | En uso |
| `usePaymentIntent` | Proyecto — Server State (TanStack Query) | features/payment/api/payment.api.ts | Server State | Escritura (useMutation). POST /payment/process crea (o reutiliza) el PaymentIntent en Stripe: es una escritura, por eso | features/payment/ui/StripePayment.tsx | En uso |
| `usePayments` | Proyecto — Server State (TanStack Query) | features/payment/api/payment.api.ts | Server State | Lectura (useQuery). Historial de pagos del usuario (Account hub) | features/payment/ui/PaymentHistory.tsx | En uso |
| `useCreateReview` | Proyecto — Server State (TanStack Query) | features/review/api/review.api.ts | Server State | Escritura (useMutation). Publica por GraphQL y refresca lista + resumen del producto. | features/review/ui/ReviewForm.tsx | En uso |
| `useDeleteReview` | Proyecto — Server State (TanStack Query) | features/review/api/review.api.ts | Server State | Escritura (useMutation). Reseñas: lecturas REST (Axios) con cache de TanStack Query y publicación por GraphQL | features/review/ui/ReviewList.tsx | En uso |
| `useReviewSummary` | Proyecto — Server State (TanStack Query) | features/review/api/review.api.ts | Server State | Lectura (useQuery). Reseñas: lecturas REST (Axios) con cache de TanStack Query y publicación por GraphQL | features/review/ui/ReviewSummary.tsx | En uso |
| `useReviews` | Proyecto — Server State (TanStack Query) | features/review/api/review.api.ts | Server State | Lectura (useQuery). Listado paginado; "keepPreviousData" mantiene la página anterior visible mientras llega la nueva (sin parpadeo) | features/review/ui/ReviewList.tsx | En uso |
| `useUpdateReview` | Proyecto — Server State (TanStack Query) | features/review/api/review.api.ts | Server State | Escritura (useMutation). Reseñas: lecturas REST (Axios) con cache de TanStack Query y publicación por GraphQL | — | Definido, sin uso todavía |
| `useClearHistory` | Proyecto — Server State (TanStack Query) | features/search/api/search.api.ts | Server State | Escritura (useMutation). Búsqueda facetada, sugerencias, búsqueda visual e historial (TanStack Query). | — | Definido, sin uso todavía |
| `useImageSearch` | Proyecto — Server State (TanStack Query) | features/search/api/search.api.ts | Server State | Escritura (useMutation). Sube la imagen (multipart) y recibe productos visualmente similares (pgvector) | features/search/ui/ImageSearch.tsx | En uso |
| `useRecentSearches` | Proyecto — Server State (TanStack Query) | features/search/api/search.api.ts | Server State | Lectura (useQuery). Historial del servidor (solo con sesión) | features/search/ui/SearchBar.tsx | En uso |
| `useSearch` | Proyecto — Server State (TanStack Query) | features/search/api/search.api.ts | Server State | Lectura (useQuery). Resultados + facetas; "keepPreviousData" mantiene los resultados anteriores mientras llegan los nuevos | features/search/ui/SearchResults.tsx | En uso |
| `useSuggestions` | Proyecto — Server State (TanStack Query) | features/search/api/search.api.ts | Server State | Lectura (useQuery). Autocompletado (se habilita desde 2 caracteres; el llamador aplica debounce) | features/search/ui/SearchBar.tsx | En uso |
| `usePreferences` | Proyecto — Server State (TanStack Query) | features/settings/api/settings.api.ts | Server State | Lectura + escritura. Configuración de la cuenta: perfil, contraseña, 2FA, preferencias de notificación y baja (GDPR). | features/settings/ui/NotifSettings.tsx | En uso |
| `useSettingsActions` | Proyecto — Server State (TanStack Query) | features/settings/api/settings.api.ts | Server State | Escritura (useMutation). Mutaciones de la cuenta; "ctx" evita repetir token/userId en cada una (DRY) | features/settings/ui/ProfileSettings.tsx<br>features/settings/ui/SecuritySettings.tsx | En uso |
| `useAuthStore` | Proyecto — slice Redux Toolkit | features/auth/model/auth.store.ts | Client State | Estado EFÍMERO del flujo de login en varios pasos (credenciales -> código 2FA). | features/auth/ui/LoginForm.tsx | En uso |
| `useCartCoupon` | Proyecto — slice Redux Toolkit | features/cart/model/cart.store.ts | Client State | Cupón aplicado en el carrito que se lleva al iniciar el checkout. | app/[locale]/(commerce)/cart/CartView.tsx<br>features/cart/ui/CartSummary.tsx<br>widgets/cart/MiniCart.tsx | En uso |
| `useCheckoutDraft` | Proyecto — slice Redux Toolkit | features/checkout/model/checkout.store.ts | Client State | Selección en curso del paso de envío (dirección + tarifa) antes de guardarla. | features/checkout/ui/AddressForm.tsx<br>features/checkout/ui/ConfirmButton.tsx | En uso |
| `useBadgeSelection` | Proyecto — slice Redux Toolkit | features/loyalty/model/loyalty.store.ts | Client State | Insignia seleccionada en la galería (panel de detalle con datos on-chain). | features/loyalty/ui/NFTBadgeGallery.tsx | En uso |
| `useLiveNotification` | Proyecto — slice Redux Toolkit | features/notification/model/notification.store.ts | Client State | Última notificación recibida por WebSocket mientras se muestra el aviso | features/notification/ui/NotificationBell.tsx<br>features/notification/ui/NotificationToast.tsx | En uso |
| `useOrderFilter` | Proyecto — slice Redux Toolkit | features/order/model/order.store.ts | Client State | Filtro de estado del listado de pedidos, conservado al volver desde un detalle. | features/order/ui/OrderList.tsx | En uso |
| `usePaymentProcessing` | Proyecto — slice Redux Toolkit | features/payment/model/payment.store.ts | Client State | Evita confirmar dos veces el mismo pago (doble clic o reintento impaciente) | features/payment/ui/StripePayment.tsx | En uso |
| `useRecentlyViewed` | Proyecto — slice Redux Toolkit | features/product/model/product.store.ts | Client State | Productos vistos recientemente. | features/product/ui/ProductVariants.tsx<br>widgets/product/ProductCarousel.tsx | En uso |
| `useReviewFilter` | Proyecto — slice Redux Toolkit | features/review/model/review.store.ts | Client State | Filtro por estrellas compartido entre ReviewSummary (clic en una barra) y | features/review/ui/ReviewList.tsx<br>features/review/ui/ReviewSummary.tsx | En uso |
| `useLocalRecentSearches` | Proyecto — slice Redux Toolkit | features/search/model/search.store.ts | Client State | Búsquedas recientes LOCALES para visitantes sin sesión | features/search/ui/SearchBar.tsx | En uso |
| `useDisplayPreferences` | Proyecto — slice Redux Toolkit | features/settings/model/settings.store.ts | Client State | Preferencias de visualización del usuario (accesibilidad) | features/settings/ui/ThemeSettings.tsx | En uso |
| `useCart` | Proyecto — slice Redux Toolkit | shared/hook/useCart.ts | Client State | Estado de UI del carrito compartido entre widgets (Header) y features (Cart, Product). | features/cart/ui/CartBadge.tsx<br>features/cart/ui/CartDrawer.tsx<br>features/product/ui/AddToCartButton.tsx<br>widgets/cart/MiniCart.tsx | En uso |
| `useToastStore` | Proyecto — slice Redux Toolkit | shared/ui/Toast.tsx | Client State | Notificaciones efímeras ("Agregado al carrito"). | shared/ui/Toast.tsx | En uso |
| `useCompleteLogin` | Proyecto — hook local | features/auth/ui/LoginForm.tsx | Sesión | Hook compartido por ambos pasos y por el login con wallet: crea la sesión de next-auth y redirige (DRY) | features/auth/ui/OAuthButtons.tsx | En uso |
| `useChatStore` | Proyecto — slice Redux Toolkit | features/ai-chat/model/chat.store.ts | Client State | Slice Redux: conversación activa y tokens que llegan por SSE (el historial va en TanStack Query) | — | Planificado — Fase 5B/6 |
| `useSocialStore` | Proyecto — slice Redux Toolkit | features/social-commerce/model/social.store.ts | Client State | Slice Redux: filtros y selección del feed (publicaciones en TanStack Query) | — | Planificado — Fase 6 |
| `useDashboardStore` | Proyecto — slice Redux Toolkit | features/admin-dashboard/model/dashboard.store.ts | Client State | Slice Redux: filtros, pestañas y selección del panel admin (KPIs en TanStack Query) | — | Planificado — Fase 7 |
| `useMediaStore` | Proyecto — slice Redux Toolkit | features/media/model/media.store.ts | Client State | Slice Redux: selección y vista de la galería de medios (archivos en TanStack Query) | — | Planificado — Fase 7 |

### 🟩 Hooks de Vue — Nuxt (Hook = ciclo de vida `on…` · Composable = funciones `use…` · API / función = `ref`, `define…`, utilidades)

Nuxt aún no tiene código (Fase 8): esta es la lista planificada a partir del árbol de 05_NUXTJS3.md y de la hoja Nuxt.js 3 de la matriz. Un hook o composable por fila, agrupados por tipo. Equivalencias con Next.js: useFetch/useAsyncData = Server State (como TanStack Query), Pinia = Client State (como Redux Toolkit), ref = estado local (como useState), Vee-Validate = formularios (como Formik). Las librerías marcadas "a instalar" o "decidir" se confirman al iniciar la Fase 8.

| Nombre | Clase (hook / composable / API) | Tipo | Origen | Estado | Para qué | Dónde se usará | Situación |
|---|---|---|---|---|---|---|---|
| `onMounted` | Hook | Hook de ciclo de vida (Vue) | vue | Ciclo de vida | Código solo en navegador al montar: GrapesJS, GSAP, beforeinstallprompt, Service Worker | CMSPageEditor.vue · HeroSection.vue · InstallPrompt.vue · useCMSEditor.ts · usePWAInstall.ts | Planificado — Fase 8 |
| `onBeforeUnmount` | Hook | Hook de ciclo de vida (Vue) | vue | Ciclo de vida | Limpieza: destruir el editor GrapesJS, timelines GSAP, intervalos y sockets | useCMSEditor.ts · useLanding.ts · useCountdown.ts · useWebSocket.ts | Planificado — Fase 8 |
| `onUnmounted` | Hook | Hook de ciclo de vida (Vue) | vue | Ciclo de vida | Limpieza: destruir el editor GrapesJS, timelines GSAP, intervalos y sockets | useCMSEditor.ts · useLanding.ts · useCountdown.ts · useWebSocket.ts | Planificado — Fase 8 |
| `ref` | API / función | API de Composition (Vue) | vue | Estado local | Estado local reactivo de un componente (equivale a useState) | Todos los componentes .vue y composables | Planificado — Fase 8 |
| `reactive` | API / función | API de Composition (Vue) | vue | Estado local | Objeto reactivo local (formularios del editor, opciones) | features/cms/composable/useCMSEditor.ts · features/config/ui/*Form.vue | Planificado — Fase 8 |
| `computed` | API / función | API de Composition (Vue) | vue | Derivado | Valores derivados cacheados (totales, filtros, tiempo restante) | Componentes y composables (useCountdown, useStoreConfig, SocialAnalyticsDash.vue) | Planificado — Fase 8 |
| `watch` | API / función | API de Composition (Vue) | vue | Efecto | Reacciona a cambios (ruta, filtros, idioma) y dispara efectos | useSEOMeta.ts · useSocialCommerce.ts · useInfiniteScroll.ts | Planificado — Fase 8 |
| `watchEffect` | API / función | API de Composition (Vue) | vue | Efecto | Efecto que rastrea dependencias automáticamente | useLanding.ts (tracking) · useCacheManager.ts | Planificado — Fase 8 |
| `provide` | API / función | API de Composition (Vue) | vue | Contexto | Compartir estado de un árbol de componentes sin prop drilling (PWA, editor CMS) | features/pwa/ui/* · features/cms/ui/CMSBlockRenderer.vue | Planificado — Fase 8 |
| `inject` | API / función | API de Composition (Vue) | vue | Contexto | Compartir estado de un árbol de componentes sin prop drilling (PWA, editor CMS) | features/pwa/ui/* · features/cms/ui/CMSBlockRenderer.vue | Planificado — Fase 8 |
| `nextTick` | API / función | API de Composition (Vue) | vue | Ciclo de vida | Esperar a que el DOM se actualice antes de medir o animar | useLanding.ts (GSAP) · CMSPreview.vue | Planificado — Fase 8 |
| `useTemplateRef` | Composable | API de Composition (Vue) | vue | Estado local | Referencia a un elemento del template (contenedor GrapesJS, slider) | CMSPageEditor.vue · TestimonialSlider.vue · HeroSection.vue | Planificado — Fase 8 |
| `useFetch` | Composable | Composable de Nuxt | nuxt (auto-import) | Server State | Lecturas del backend con SSR, caché por clave, refresh y estados pending/error (equivale a useQuery) | features/*/api/*.api.ts · app/**/page.vue | Planificado — Fase 8 |
| `useAsyncData` | Composable | Composable de Nuxt | nuxt (auto-import) | Server State | Lecturas del backend con SSR, caché por clave, refresh y estados pending/error (equivale a useQuery) | features/*/api/*.api.ts · app/**/page.vue | Planificado — Fase 8 |
| `useRoute` | Composable | Composable de Nuxt | nuxt (auto-import) | Navegación | Parámetros [slug]/[id]/[platform] y navegación programática | app/**/[slug]/page.vue · social/checkout · middleware | Planificado — Fase 8 |
| `useRouter` | Composable | Composable de Nuxt | nuxt (auto-import) | Navegación | Parámetros [slug]/[id]/[platform] y navegación programática | app/**/[slug]/page.vue · social/checkout · middleware | Planificado — Fase 8 |
| `useNuxtApp` | Composable | Composable de Nuxt | nuxt (auto-import) | Infraestructura | Registrar plugins (Pinia, Vee-Validate, analítica) y usarlos | plugins/pinia.ts · plugins/vee-validate.ts · plugins/analytics.client.ts | Planificado — Fase 8 |
| `useRuntimeConfig` | Composable | Composable de Nuxt | nuxt (auto-import) | Configuración | URL de la API y claves públicas (NUXT_PUBLIC_*) | shared/lib/api-client.ts · shared/constants/config.ts | Planificado — Fase 8 |
| `useCookie` | Composable | Composable de Nuxt | nuxt (auto-import) | Sesión | Cookie de sesión compartida con Next.js en el mismo dominio | shared/composable/useAuth.ts · shared/lib/auth-config.ts | Planificado — Fase 8 |
| `useHead` | Composable | Composable de Nuxt | nuxt (auto-import) | SEO | Title, meta, Open Graph, canonical y JSON-LD | features/seo/composable/useSEOMeta.ts · SchemaOrgMeta.vue · blog/events/landing | Planificado — Fase 8 |
| `useSeoMeta` | Composable | Composable de Nuxt | nuxt (auto-import) | SEO | Title, meta, Open Graph, canonical y JSON-LD | features/seo/composable/useSEOMeta.ts · SchemaOrgMeta.vue · blog/events/landing | Planificado — Fase 8 |
| `useError` | Composable | Composable de Nuxt | nuxt (auto-import) | Errores | Página de error y errores 404/500 reales | app/error.vue · app/**/[slug]/page.vue | Planificado — Fase 8 |
| `refreshNuxtData` | API / función | Utilidad de Nuxt | nuxt (auto-import) | Server State | Invalidar solo los datos afectados tras una escritura (equivale a invalidateQueries) | features/*/composable/* tras guardar | Planificado — Fase 8 |
| `clearNuxtData` | API / función | Utilidad de Nuxt | nuxt (auto-import) | Server State | Invalidar solo los datos afectados tras una escritura (equivale a invalidateQueries) | features/*/composable/* tras guardar | Planificado — Fase 8 |
| `navigateTo` | API / función | Utilidad de Nuxt | nuxt (auto-import) | Navegación | Redirecciones en páginas y middleware (login, sin permiso) | middleware/auth.ts · middleware/rbac.ts | Planificado — Fase 8 |
| `showError` | API / función | Utilidad de Nuxt | nuxt (auto-import) | Errores | Página de error y errores 404/500 reales | app/error.vue · app/**/[slug]/page.vue | Planificado — Fase 8 |
| `clearError` | API / función | Utilidad de Nuxt | nuxt (auto-import) | Errores | Página de error y errores 404/500 reales | app/error.vue · app/**/[slug]/page.vue | Planificado — Fase 8 |
| `queryCollection` | API / función | Utilidad de Nuxt | @nuxt/content (a instalar en Fase 8) | Contenido | Leer posts, páginas y docs en Markdown/MDC (content/) | app/blog/** · features/seo/ui/BlogPostContent.vue | Planificado — Fase 8 |
| `definePageMeta` | API / función | Función de definición | nuxt (auto-import) | Navegación | Layout y middleware por página (admin, cms, landing, blank) | app/**/page.vue | Planificado — Fase 8 |
| `defineNuxtRouteMiddleware` | API / función | Función de definición | nuxt (auto-import) | Seguridad | Guards de ruta: sesión, rol (RBAC) y analítica | middleware/auth.ts · middleware/rbac.ts · middleware/analytics.ts | Planificado — Fase 8 |
| `defineNuxtPlugin` | API / función | Función de definición | nuxt (auto-import) | Infraestructura | Registrar plugins (Pinia, Vee-Validate, analítica) y usarlos | plugins/pinia.ts · plugins/vee-validate.ts · plugins/analytics.client.ts | Planificado — Fase 8 |
| `defineStore` | API / función | Función de definición | pinia | Client State | Define cada store de cliente (equivale a createSlice de Redux Toolkit) | features/*/model/*.store.ts | Planificado — Fase 8 |
| `useI18n` | Composable | Composable de librería | @nuxtjs/i18n (a instalar en Fase 8; i18n/ ya existe) | i18n | Textos ES/EN y rutas con idioma | Todos los componentes con texto · layouts | Planificado — Fase 8 |
| `useLocalePath` | Composable | Composable de librería | @nuxtjs/i18n (a instalar en Fase 8; i18n/ ya existe) | i18n | Textos ES/EN y rutas con idioma | Todos los componentes con texto · layouts | Planificado — Fase 8 |
| `storeToRefs` | API / función | Composable de librería | pinia | Client State | Desestructurar el store sin perder reactividad | Componentes que leen stores | Planificado — Fase 8 |
| `useForm` | Composable | Composable de librería | vee-validate | Formulario | Estado y validación de formularios (equivale a Formik en Next) | LeadCaptureForm.vue · SocialCheckoutForm.vue · PaymentGatewayForm.vue · ShippingCarrierForm.vue · StoreCurrencyForm.vue · TaxRatesForm.vue | Planificado — Fase 8 |
| `useField` | Composable | Composable de librería | vee-validate | Formulario | Estado y validación de formularios (equivale a Formik en Next) | LeadCaptureForm.vue · SocialCheckoutForm.vue · PaymentGatewayForm.vue · ShippingCarrierForm.vue · StoreCurrencyForm.vue · TaxRatesForm.vue | Planificado — Fase 8 |
| `toTypedSchema` | API / función | Composable de librería | @vee-validate/zod | Formulario | Usa los esquemas Zod compartidos (@ecommerce/shared-types) | features/*/lib/*.validator.ts | Planificado — Fase 8 |
| `useMediaQuery` | Composable | Composable de librería | @vueuse/core | UI | Diseño responsive | shared/composable/useMediaQuery.ts | Planificado — Fase 8 |
| `useDebounceFn` | Composable | Composable de librería | @vueuse/core | UI | Retrasa búsquedas y autoguardado | shared/composable/useDebounce.ts | Planificado — Fase 8 |
| `useInfiniteScroll` | Composable | Composable de librería | @vueuse/core | UI | Carga incremental de listados (blog, lookbooks, productos sociales) | shared/composable/useInfiniteScroll.ts | Planificado — Fase 8 |
| `useWebSocket` | Composable | Composable de librería | @vueuse/core | Server State (tiempo real) | Conexión en vivo con reconexión (métricas sociales, notificaciones) | shared/composable/useWebSocket.ts | Planificado — Fase 8 |
| `useIntervalFn` | Composable | Composable de librería | @vueuse/core | UI | Cuenta regresiva de eventos y landings | shared/composable/useCountdown.ts · CountdownTimer.vue | Planificado — Fase 8 |
| `useNow` | Composable | Composable de librería | @vueuse/core | UI | Cuenta regresiva de eventos y landings | shared/composable/useCountdown.ts · CountdownTimer.vue | Planificado — Fase 8 |
| `useOnline` | Composable | Composable de librería | @vueuse/core | UI | Indicador sin conexión de la PWA | features/pwa/ui/OfflineIndicator.vue | Planificado — Fase 8 |
| `useIntersectionObserver` | Composable | Composable de librería | @vueuse/core | UI | Disparar animaciones GSAP al entrar en pantalla | features/landing/composable/useLanding.ts | Planificado — Fase 8 |
| `useEventListener` | Composable | Composable de librería | @vueuse/core | UI | Eventos del navegador (beforeinstallprompt, appinstalled) | features/pwa/composable/usePWAInstall.ts | Planificado — Fase 8 |
| `usePermission` | Composable | Composable de librería | @vueuse/core | UI | Permiso de notificaciones push | features/pwa/composable/usePushNotif.ts | Planificado — Fase 8 |
| `useQuery (Apollo)` | Composable | Composable de librería | @vue/apollo-composable (decidir en Fase 8) | Server State | Consultas, mutaciones y suscripciones GraphQL que la matriz marca para Nuxt | features/*/api/*.api.ts | Planificado — Fase 8 |
| `useMutation (Apollo)` | Composable | Composable de librería | @vue/apollo-composable (decidir en Fase 8) | Server State | Consultas, mutaciones y suscripciones GraphQL que la matriz marca para Nuxt | features/*/api/*.api.ts | Planificado — Fase 8 |
| `useSubscription (Apollo)` | Composable | Composable de librería | @vue/apollo-composable (decidir en Fase 8) | Server State | Consultas, mutaciones y suscripciones GraphQL que la matriz marca para Nuxt | features/*/api/*.api.ts | Planificado — Fase 8 |
| `useLandingStore` | Composable | Store Pinia del proyecto | features/landing/model/landing.store.ts | Client State | Estado de UI de las landings (paso del lead, variante A/B) | features/landing/ui/* · useLanding.ts | Planificado — Fase 8 |
| `useCmsStore` | Composable | Store Pinia del proyecto | features/cms/model/cms.store.ts | Client State | Editor: bloque seleccionado, cambios sin guardar, vista previa | features/cms/ui/* · useCMSEditor.ts | Planificado — Fase 8 |
| `useSeoStore` | Composable | Store Pinia del proyecto | features/seo/model/seo.store.ts | Client State | Filtros del blog y eventos | features/seo/ui/* | Planificado — Fase 8 |
| `useSocialStore` | Composable | Store Pinia del proyecto | features/social-commerce/model/social.store.ts | Client State | Plataforma activa y filtros de analítica social | features/social-commerce/ui/* · useSocialCommerce.ts | Planificado — Fase 8 |
| `usePwaStore` | Composable | Store Pinia del proyecto | features/pwa/model/pwa.store.ts | Client State | Instalable, online/offline, actualización disponible, push activo | features/pwa/ui/* · usePWAInstall.ts · usePushNotif.ts | Planificado — Fase 8 |
| `useConfigStore` | Composable | Store Pinia del proyecto | features/config/model/config.store.ts | Client State | Pestaña y borradores de la configuración global (pagos, envíos, impuestos, moneda) | features/config/ui/* · useStoreConfig.ts | Planificado — Fase 8 |
| `useAuth` | Composable | Composable del proyecto | shared/composable/useAuth.ts | Sesión | Usuario, roles y logout (cookie de sesión) | middleware/auth.ts · middleware/rbac.ts · layouts/admin.vue | Planificado — Fase 8 |
| `useToast` | Composable | Composable del proyecto | shared/composable/useToast.ts | Client State | Avisos efímeros | Toda la app | Planificado — Fase 8 |
| `useMediaQuery` | Composable | Composable del proyecto | shared/composable/useMediaQuery.ts | UI | Breakpoints del diseño | layouts · AdminHeader.vue | Planificado — Fase 8 |
| `useDebounce` | Composable | Composable del proyecto | shared/composable/useDebounce.ts | UI | Debounce de búsquedas y autoguardado | features/cms · features/seo | Planificado — Fase 8 |
| `useInfiniteScroll` | Composable | Composable del proyecto | shared/composable/useInfiniteScroll.ts | UI | Paginación infinita | blog · lookbooks · social | Planificado — Fase 8 |
| `useWebSocket` | Composable | Composable del proyecto | shared/composable/useWebSocket.ts | Server State (tiempo real) | Socket con token y reconexión | features/social-commerce · features/pwa | Planificado — Fase 8 |
| `useCountdown` | Composable | Composable del proyecto | shared/composable/useCountdown.ts | UI | Tiempo restante de un evento | CountdownTimer.vue (landing y events) | Planificado — Fase 8 |
| `useLanding` | Composable | Composable del proyecto | features/landing/composable/useLanding.ts | UI | Animaciones GSAP y tracking de la landing | HeroSection.vue · LeadCaptureForm.vue | Planificado — Fase 8 |
| `useCMSEditor` | Composable | Composable del proyecto | features/cms/composable/useCMSEditor.ts | UI | Ciclo de vida del editor GrapesJS (crear, guardar, destruir) | CMSPageEditor.vue | Planificado — Fase 8 |
| `useCMSBlocks` | Composable | Composable del proyecto | features/cms/composable/useCMSBlocks.ts | UI | Fábrica de bloques del editor | CMSPageEditor.vue · CMSBlockRenderer.vue | Planificado — Fase 8 |
| `useSEOMeta` | Composable | Composable del proyecto | features/seo/composable/useSEOMeta.ts | SEO | Meta tags y JSON-LD por página (useHead/useSeoMeta) | blog · events · categories · landing | Planificado — Fase 8 |
| `useSocialCommerce` | Composable | Composable del proyecto | features/social-commerce/composable/useSocialCommerce.ts | UI | Lógica de publicación y checkout social | SocialProductCard.vue · SocialCheckoutForm.vue | Planificado — Fase 8 |
| `usePWAInstall` | Composable | Composable del proyecto | features/pwa/composable/usePWAInstall.ts | UI | Mostrar el aviso de instalación de la PWA | InstallPrompt.vue | Planificado — Fase 8 |
| `usePushNotif` | Composable | Composable del proyecto | features/pwa/composable/usePushNotif.ts | UI | Suscribir/desuscribir notificaciones push | PushToggle.vue | Planificado — Fase 8 |
| `useCacheManager` | Composable | Composable del proyecto | features/pwa/composable/useCacheManager.ts | UI | Estrategias de caché de Workbox y limpieza | CacheStatus.vue · UpdateBanner.vue | Planificado — Fase 8 |
| `useStoreConfig` | Composable | Composable del proyecto | features/config/composable/useStoreConfig.ts | UI | Guardar la configuración global (pagos, envíos, impuestos, moneda) | features/config/ui/*Form.vue | Planificado — Fase 8 |

---
## 📦 MÓDULOS Y FUNCIONALIDADES

### Frontend — Next.js 15 (32 módulos, hoja "📱 Next.js 15")

| # | Módulo | Funcionalidad | API |
|---|---|---|---|
| 1 | Auth (Autenticación) | Autenticación: login, registro, verificación email, 2FA, OAuth2, Web3 wallets | REST + GraphQL |
| 2 | Users (Usuarios) | Gestión usuarios: CRUD completo, perfil, direcciones, métodos pago, GDPR | REST + GraphQL |
| 3 | Roles (Roles) | Gestión roles: CRUD, control permisos, jerarquías | REST |
| 4 | Permissions (Permisos) | Gestión permisos: CRUD granulares, control acceso | REST |
| 5 | Products (Productos) | Productos: CRUD, variantes, imágenes Cloudinary, stock tiempo real, predicción IA FastAPI | REST + GraphQL |
| 6 | Categories (Categorías) | Categorías: CRUD, jerarquía ilimitada, breadcrumb, SEO | REST + GraphQL |
| 7 | Brands (Marcas) | Marcas: CRUD, logo Cloudinary, estadísticas ventas | REST |
| 8 | Collections (Colecciones) | Colecciones: CRUD, looks completos, descuentos automáticos | REST + GraphQL |
| 9 | Cart (Carrito) | Carrito: validación stock MCP Rust <10ms, totales automáticos, syncWebSocket | REST + GraphQL |
| 10 | Search (Búsqueda) | Búsqueda: texto, voz, imagen IA FastAPI, lenguaje natural LangChain, historial | REST + GraphQL |
| 11 | Checkout (Finalizar Compra) | Checkout: wizard multi-paso, validación Zod, 1-click, pago MCP Rust <20ms | REST + GraphQL |
| 12 | Orders (Pedidos) | Pedidos: tracking tiempo realWebSocket, facturación DIAN, reordenar 1-click | REST + GraphQL |
| 13 | Payments (Pagos) | Pagos: Stripe/PSE/crypto, MCP Rust <20ms, detección fraude FastAPI, blockchain | REST + GraphQL |
| 14 | Shipping (Envío) | Envío: APIs transportadoras colombianas, guías automáticas, trackingWebSocket | REST + GraphQL |
| 15 | Invoicing (Facturación) | Facturación electrónica: generación automática DIAN, descarga PDF, cumplimiento Colombia | REST |
| 16 | Returns (Devoluciones) | Devoluciones: autoservicio, etiqueta PDF, tracking tiempo real, reembolso automático | REST + GraphQL |
| 17 | Coupons (Cupones) | Cupones: código único, promociones 2x1/3x2/4x3, restricciones, estadísticas | REST |
| 18 | Loyalty (Fidelidad) | Fidelidad: puntos gamificado, niveles, NFT badges blockchain Rust, leaderboard | REST + GraphQL |
| 19 | Reviews (Reseñas) | Reseñas: calificación estrellas, fotos Cloudinary, análisis sentimiento IA FastAPI, moderación | REST + GraphQL |
| 20 | Notifications (Notificaciones) | Notificaciones: multi-canal push/email/WhatsApp tiempo real, preferencias, MCP críticas | REST + GraphQL |
| 21 | Social Commerce (Comercio Social) | Social Commerce: Instagram/TikTok/Facebook Shopping, catálogos sync tiempo real, analytics | REST + GraphQL |
| 22 | Automation (Automatización) | Automatización n8n: workflows visuales sin código, triggers múltiples, logs auditables, MCP | REST + GraphQL |
| 23 | Communication (Comunicación) | Communication: chatbot IA LangChain+Ollama local 24/7, NLU FastAPI intenciones/NER entidades, Chatwoot… | REST + GraphQL |
| 24 | Analytics (Analítica) | Analytics: métricas tiempo realWebSocket, KPIs, gráficos Chart.js, forecasting IA FastAPI ML, Rust <5ms | REST + GraphQL |
| 25 | Inventory (Inventario) | Inventario: control stock tiempo real Rust <10ms atómicas, multi-bodega, alertas, predicción IA FastAPI | REST + GraphQL |
| 26 | Suppliers (Proveedores) | Proveedores: CRUD, historial compras, evaluación desempeño, cuentas por pagar, ranking, órdenes compra | REST + GraphQL |
| 27 | AI Recommendations (Recomendaciones IA) | Recomendaciones IA: personalizadas historial/comportamiento, Personal Shopper 24/7 LangChain+Ollama local… | REST + GraphQL |
| 28 | AI Graph Analysis (Análisis Relacional IA) | Análisis relacional IA: grafo productos relaciones LangGraph comprados juntos/similares… | REST + GraphQL |
| 29 | Email (Correo Electrónico) | Emails: automáticos bienvenida/confirmación/carrito abandonado/reactivación… | REST |
| 30 | Marketing Automation (Automatización de Marketing) | Marketing automation: campañas masivas email segmentadas IA FastAPI, diseñador visual drag-drop… | REST + GraphQL |
| 31 | CRM (Gestión de Clientes) | CRM: base datos completa clientes, perfil 360°, segmentación automática IA FastAPI… | REST + GraphQL |
| 32 | LLM Assistant (Asistente LLM) | LLM Assistant (cliente): chat con el asistente de FastAPI sobre LLM local Ollama… | REST |

### Frontend — Nuxt.js 3 (17 módulos, hoja "🛠️ Nuxt.js 3")

| # | Módulo | Funcionalidad | API |
|---|---|---|---|
| 1 | Landing Pages (Páginas de Aterrizaje) | Landings promocionales dinámicas: hero sections impactantes, ofertas especiales… | REST + GraphQL |
| 2 | CMS Pages (Páginas CMS) | Editor visual contenido páginas estáticas: drag-drop editor profesional GrapesJS sin código técnico… | REST + GraphQL |
| 3 | CMS Lookbooks (Lookbooks CMS) | Lookbooks galerías productos visuales: galerías productos visuales atractivas inspiración clientes lookbooks… | REST + GraphQL |
| 4 | CMS Collections (Colecciones CMS) | Colecciones visuales productos: colecciones visuales productos organizadas categorías temporadas eventos… | REST + GraphQL |
| 5 | SEO Categories (Categorías SEO) | Categorías SEO optimizadas: meta tags dinámicos por categoría personalizados… | REST + GraphQL |
| 6 | SEO Events (Eventos SEO) | Eventos especiales páginas SEO optimizadas: páginas eventos especiales Black Friday/Cyber… | REST + GraphQL |
| 7 | SEO Blog (Blog SEO) | Blog posts SEO optimizados: posts blog SEO optimizados ricos keywords long-tail posicionamiento orgánico… | REST + GraphQL |
| 8 | Social Commerce Products (Productos de Comercio Social) | Social Commerce gestión productos: publicar productos Instagram/TikTok/Facebook Shopping… | REST + GraphQL |
| 9 | Social Commerce Checkout (Compra de Comercio Social) | Social Commerce checkout nativo: checkout nativo redes sociales sin abandonar plataforma seamless conversión… | REST + GraphQL |
| 10 | Social Commerce Analytics (Analítica de Comercio Social) | Social Commerce analytics: analytics engagement cross-platform detallado views/clicks/purchases por red… | REST + GraphQL |
| 11 | Social Commerce Influencers (Influencers de Comercio Social) | Social Commerce influencers: dashboard influencers comisiones calculadas automático tracking referidos… | REST + GraphQL |
| 12 | PWA Installation (Instalación PWA) | PWA instalación: install prompt PWA app dispositivo native beforeinstallprompt add-to-home-screen experiencia… | REST |
| 13 | PWA Offline Mode (Modo sin Conexión PWA) | PWA offline mode: offline mode funcional completo navegación sin internet fallback elegante branded… | REST |
| 14 | PWA Notifications (Notificaciones PWA) | PWA notificaciones push: notificaciones push navegador/app nativas Web Push API engagement usuarios… | REST |
| 15 | PWA Cache Manager (Gestor de Caché PWA) | PWA cache manager: gestión caché service worker estratégico… | REST |
| 16 | Global Payment Config (Configuración Global de Pagos) | Configuración métodos pago: Stripe internacional/PSE bancos colombianos/transferencias bancarias/contra… | REST + GraphQL |
| 17 | Global Shipping Config (Configuración Global de Envío) | Configuración transportadoras: Servientrega/Coordinadora/Deprisa Colombia… | REST + GraphQL |

### Backend — Express TypeScript (37 módulos, agrupados por contenedor como en la hoja "⚙️ Express TS")

#### 🌐 Infraestructura (1 módulo)

| # | Módulo | Funcionalidad | API |
|---|---|---|---|
| 1 | API Gateway (Puerta de Enlace API Nginx) | Un solo dominio y una sola cookie para Next.js y Nuxt; composición de microfrontends por rutas… | REST + GraphQL |

#### 🛒 Core Commerce (9 módulos)

| # | Módulo | Funcionalidad | API |
|---|---|---|---|
| 2 | Auth (Autenticación) | Login, registro, verificación email/teléfono, recuperación contraseña, 2FA, OTP, Magic Links… | REST + GraphQL |
| 3 | Users (Usuarios) | CRUD usuarios, gestión perfiles, roles, permisos, direcciones múltiples guardadas, métodos pago tokenizados… | REST + GraphQL |
| 4 | Roles (Roles) | CRUD roles, control permisos, asignar/revocar roles, jerarquías roles, control acceso rutas… | REST |
| 5 | Permissions (Permisos) | CRUD permisos, permisos granulares, asignación a roles, control acceso recursos, auditoría cambios permisos | REST |
| 6 | Products (Productos) | CRUD productos, gestión variantes (tallas/colores/materiales), imágenes múltiples Cloudinary optimizadas… | REST + GraphQL |
| 7 | Categories (Categorías) | CRUD categorías, organización jerárquica ilimitada subcategorías, navegación árbol categorías… | REST + GraphQL |
| 8 | Brands (Marcas) | CRUD marcas ropa fabricantes, información detallada marca (nombre/logo/descripción/historia/país origen/sitio… | REST |
| 9 | Collections (Colecciones) | CRUD colecciones especiales, temporadas, colaboraciones, looks completos, destacar colecciones… | REST + GraphQL |
| 10 | Cart (Carrito) | Gestión carrito compras tiempo real, agregar/actualizar/eliminar productos, carrito flotante/lateral preview… | REST + GraphQL + MCP |

#### 📦 Business Ops (7 módulos)

| # | Módulo | Funcionalidad | API |
|---|---|---|---|
| 11 | Advanced Search (Búsqueda Avanzada) | Búsqueda texto con autocompletado inteligente, búsqueda voz… | REST + GraphQL |
| 12 | Checkout (Finalizar Compra) | Proceso checkout completo multi-paso wizard optimizado conversión… | REST + GraphQL |
| 13 | Orders (Pedidos) | Gestión completa pedidos e-commerce, rastreo tiempo real pedidosWebSocket… | REST + GraphQL |
| 14 | Payments (Pagos) | Procesamiento pagos múltiples métodos (Stripe, PSE, transferencias bancarias, contra entrega… | REST + GraphQL + MCP |
| 15 | Shipping (Envío) | Gestión completa envíos y transportadoras, integración APIs transportadoras colombianas… | REST + GraphQL |
| 16 | E-Invoicing (Facturación Electrónica) | Generación automática facturas electrónicas con cada pedido, descarga PDF formato DIAN… | REST |
| 17 | Returns & Exchanges (Devoluciones y Cambios) | Gestión completa devoluciones y cambios, solicitar devolución desde cuenta usuario autoservicio… | REST + GraphQL |

#### 🎁 Growth & CRM (7 módulos)

| # | Módulo | Funcionalidad | API |
|---|---|---|---|
| 18 | Coupons & Discounts (Cupones y Descuentos) | Gestión completa cupones descuento y promociones avanzadas… | REST |
| 19 | Loyalty Program (Programa de Fidelidad) | Sistema completo puntos lealtad gamificado, niveles membresía progresivos… | REST + GraphQL |
| 20 | Reviews (Comentarios y Reseñas) | Sistema completo reseñas y calificaciones productos, calificar productos estrellas 1-5… | REST + GraphQL |
| 21 | Notifications (Notificaciones) | Notificaciones multi-canal tiempo real (push navegador/app, email, WhatsApp, SMS opcional)… | REST + GraphQL + MCP |
| 22 | Social Commerce (Comercio Social) | Integración completa Social Commerce multicanal, compra directa Instagram Shopping checkout nativo… | REST + GraphQL |
| 23 | Automation (Automatización n8n) | Automatización completa workflows sin código n8n, workflows visuales editor sin código integrado… | REST + GraphQL + MCP |
| 24 | Communication (Comunicación) | CHATBOT IA (LangChain + Ollama): Chatbot inteligente IA 24/7 con LangChain + Ollama (IA local sin costos… | REST + GraphQL |

#### 🔐 Web3 & Security (12 módulos)

| # | Módulo | Funcionalidad | API |
|---|---|---|---|
| 25 | Analytics (Analítica) | Métricas completas tiempo realWebSocket, KPIs principales dashboard… | REST + GraphQL |
| 26 | Inventory (Inventario) | Control stock tiempo real por variante, alertas automáticas stock bajo, predicción IA cuándo agotará… | REST + GraphQL |
| 27 | Suppliers (Proveedores) | CRUD proveedores completo, información completa, historial compras, evaluación desempeño… | REST + GraphQL |
| 28 | AI Recommendations (Recomendaciones IA LangChain) | Recomendaciones personalizadas IA: historial compras, productos vistos, comportamiento… | REST + GraphQL |
| 29 | AI Graph Analysis (Análisis Relacional IA LangGraph) | Análisis relaciones productos (comprados juntos, similares), visualización grafo, recomendaciones cruzadas… | REST + GraphQL |
| 30 | Email (Correo Electrónico Nodemailer) | Emails automáticos: bienvenida, confirmación/envío/entrega pedido, carrito abandonado, favoritos descuento… | REST |
| 31 | Webhooks (Webhooks) | Webhooks Stripe confirmación pagos, Passport eventos autenticación, n8n auditorías… | REST |
| 32 | Marketing Automation (Automatización de Marketing) | Campañas masivas email, segmentados tipo cliente, diseñador visual drag-drop, plantillas predefinidas… | REST + GraphQL |
| 33 | CRM (Gestión de Clientes) | Base datos completa clientes, perfil detallado, historial compras, total gastado histórico… | REST + GraphQL |
| 34 | Audit Logs (Logs y Auditoría) | Registro auditoría todas acciones sistema, logs completos, auditoría acciones usuario/admin… | REST + GraphQL |
| 35 | Media Management (Gestión de Medios Cloudinary) | Biblioteca centralizada imágenes, subir múltiples vez, organizar carpetas, optimización automática… | REST + GraphQL |
| 36 | Admin Dashboard (Panel de Administración) | Panel administrativo completo centralizado unificado: gestión productos (CRUD completo, importación masiva… | REST + GraphQL |

#### ⚡ Edge Gateway (1 módulo)

| # | Módulo | Funcionalidad | API |
|---|---|---|---|
| 37 | MCP Server (Servidor MCP) | Transacciones tiempo real pagos, actualizaciones inventario atómicas, validaciones pagos tiempo real… | REST + GraphQL + MCP |

### Backend — FastAPI Python (11 módulos, hoja "🤖 FastAPI Python")

| # | Módulo | Tecnología ML | Caso de Uso Principal |
|---|---|---|---|
| 1 | ML Predictions (Predicciones ML) | XGBoost · Prophet · MLflow · Celery | Predicción demanda y precios |
| 2 | Image Recognition (Reconocimiento de Imágenes) | ResNet-50 · CLIP · pgvector · tf.image | Clasificar imágenes, búsqueda visual |
| 3 | Sentiment Analysis (Análisis de Sentimiento) | BERT · Transformers · mBERT | Analizar sentimiento reseñas multilenguaje |
| 4 | Customer Analytics (Analítica de Clientes) | K-Means · XGBoost · RFM · Pandas | Segmentación clientes y LTV |
| 5 | Fraud Detection (Detección de Fraude) | IsolationForest · XGBoost · sklearn | Detectar transacciones fraudulentas |
| 6 | Personalization Engine (Motor de Personalización) | FAISS · CF + CBF hybrid · sklearn | Recomendaciones personalizadas en tiempo real |
| 7 | Email Parser (Analizador de Correos) | spaCy · BERT NER · regex · bs4 | Extraer entidades de emails clientes |
| 8 | Natural Language (Lenguaje Natural) | Ollama · Llama3 · LangChain · FAISS | Chat IA local, RAG, intent detection |
| 9 | Demand Forecasting (Pronóstico de Demanda) | Prophet · ARIMA · statsmodels | Pronosticar demanda por producto/región |
| 10 | Price Optimization (Optimización de Precios) | Bandido contextual (NumPy) · XGBoost | Optimizar precios dinámicamente |
| 11 | LLM Assistant (Asistente LLM) | Ollama · LangChain · pgvector · StreamingResponse (SSE) | Asistente con RAG y tool use sobre las APIs de Express |

### Backend — Rust Axum (6 módulos, hoja "🦀 Rust Axum")

| # | Módulo | Tecnología Rust | Caso de Uso Principal |
|---|---|---|---|
| 1 | Real-time Inventory (Inventario en Tiempo Real) | DashMap · Tokio · WebSocket | Inventario en tiempo real <10ms |
| 2 | High-frequency Analytics (Analítica de Alta Frecuencia) | DashMap · Tokio channels · HTAP | Métricas de alta frecuencia streaming |
| 3 | Blockchain Integration (Integración Blockchain) | alloy · ABI | ERC-20 y ERC-721 (NFT) |
| 4 | Payment Gateway Proxy (Proxy de Pasarela de Pago) | reqwest · Tower Circuit Breaker | Proxy resiliente Stripe <10ms |
| 5 | WebSocket Gateway (Pasarela WebSocket) | axum-ws · DashMap · Tokio broadcast | Hub WebSocket con rooms y pub/sub |
| 6 | Cache Service (Servicio de Caché) | DashMap · Redis L2 · LRU eviction | Cache L1 in-memory + L2 Redis |

---

## 🔌 APIs Y PROTOCOLOS

### Protocolos / estilos de API

| Tecnología       | REST | RESTful | GraphQL               | Cliente GraphQL  | Cliente REST | MCP |
|------------------|------|---------|-----------------------|------------------|--------------|-----|
| Express (TS)     | ✅   | ✅      | ✅ Apollo Server      | —                | —            | ✅  |
| FastAPI (Python) | ✅   | ✅      | ✅ Strawberry GraphQL | —                | —            | ✅  |
| Rust (Axum)      | ✅   | ✅      | ✅ Async-GraphQL      | —                | —            | ✅  |
| Next.js          | —    | —       | ✅ Queries/Mutations  | ✅ Apollo Client | ✅ Axios     | ❌  |
| Nuxt.js          | —    | —       | ✅ Queries/Mutations  | ✅ Apollo Client | ✅ Axios     | ❌  |
| n8n              | ❌   | ❌      | ❌                    | —                | —            | ❌  |

### Protocolos / mecanismos de comunicación

| Tecnología       | WebSocket          | Webhook |
|------------------|--------------------|---------|
| Express (TS)     | ✅                 | ✅      |
| FastAPI (Python) | ❌                 | ❌      |
| Rust (Axum)      | ✅                 | ❌      |
| Next.js          | ✅ Subscriptions   | ❌      |
| Nuxt.js          | ✅ Subscriptions   | ❌      |
| n8n              | ❌                 | ✅      |

> ⚠️ **Protocolo de API ≠ Protocolo de Comunicación**
> - **Protocolo de API** = estilo de diseño del contrato (REST, RESTful, GraphQL, MCP)
> - **Protocolo de Comunicación** = transporte y mecanismos de entrega (HTTP/1.1, WebSocket ws://, Webhook, SSE)

### Versionado de API

```
/api/v1/   → Versión estable producción
/api/v2/   → Versión beta (nuevas funcionalidades)
/graphql   → Endpoint GraphQL único con schema versioning
/ws        → WebSocket namespace por módulo
```

---

## 🔐 SEGURIDAD

### Autenticación y Autorización

| Mecanismo      | Implementación                               | Alcance                           |
|----------------|----------------------------------------------|-----------------------------------|
| JWT Stateless  | jsonwebtoken · bcrypt · refresh rotativo     | Todas las APIs REST               |
| OAuth2         | Google · GitHub · Discord (Passport.js)      | Login social                      |
| RBAC           | Roles: admin, vendor, customer, moderator    | Permisos granulares por recurso   |
| 2FA            | Email OTP (TOTP: pendiente · SMS: de pago)   | Cuentas sensibles                 |
| Web3 Auth      | MetaMask signature · wallet address verify   | Operaciones blockchain            |
| API Keys       | SHA-256 signed · rate limited                | Integraciones externas            |

### Cumplimiento

- **OWASP Top 10** — Mitigación completa de las 10 vulnerabilidades críticas
- **PCI DSS** — Cumplimiento para procesamiento de tarjetas (Stripe como intermediario)
- **GDPR** — Consentimiento, derecho al olvido, exportación de datos
- **WCAG 2.1 AA** — Accesibilidad web en todas las interfaces

---

## ⚡ PERFORMANCE Y ESCALABILIDAD

### Objetivos de Performance

| Métrica             | Target              | Medición                      |
|---------------------|---------------------|-------------------------------|
| LCP                 | < 2.5s              | Lighthouse / Core Web Vitals  |
| INP                 | < 100ms             | Chrome UX Report              |
| CLS                 | < 0.1               | Lighthouse                    |
| TTFB                | < 200ms             | WebPageTest                   |
| API Response P95    | < 200ms             | Grafana / k6                  |
| Rust HPC Latency P99| < 10ms              | criterion benchmarks          |
| Lighthouse Score    | ≥ 90 todas las págs | CI/CD automated               |

### Estrategias de Performance

- **Next.js**: ISR para páginas de productos, RSC para reducir JS client-side, `next/image` WebP+AVIF, `next/font` sin FOUT
- **Nuxt.js**: SSG para landings y blog, Workbox Cache-First para assets estáticos, GSAP solo client-side
- **Express**: Redis caché, índices PostgreSQL optimizados, Bull Queue para tareas pesadas
- **FastAPI**: Celery para ML async, MLflow model caching, pgvector HNSW para búsqueda vectorial
- **Rust**: DashMap lock-free para concurrencia, Tokio zero-cost async, Circuit Breaker para resiliencia

---

## ♿ ACCESIBILIDAD Y UX

### Estándares de Accesibilidad (WCAG 2.1 AA)

| Criterio            | Implementación                                        |
|---------------------|-------------------------------------------------------|
| Contraste de color  | Mínimo 4.5:1 texto normal · 3:1 texto grande          |
| Navegación teclado  | Tab, Enter, Escape, flechas en todos los componentes  |
| Screen readers      | ARIA roles, labels, live regions en cambios dinámicos |
| Focus visible       | Outline 3px en todos los elementos focusables         |
| Skip links          | "Saltar al contenido" en todas las páginas            |
| Alt text            | Descriptivo en imágenes, vacío en decorativas         |
| Formularios         | Labels asociados, mensajes de error ARIA              |
| Modales             | Focus trap, cierre con Escape, retorno de foco        |

### Responsive Design — Breakpoints

```
xs  : 320px  → Mobile portrait mínimo
sm  : 640px  → Mobile landscape / tablet pequeño
md  : 768px  → Tablet portrait
lg  : 1024px → Tablet landscape / desktop pequeño
xl  : 1280px → Desktop
2xl : 1536px → Desktop grande / TV

Adaptaciones especiales:
- Mobile landscape: layouts horizontales optimizados
- Touch targets: mínimo 44×44px (WCAG 2.5.5)
- Gestos táctiles: swipe en carousels y drawers
- Pinch-zoom: no bloqueado
```

### Compatibilidad de Navegadores

| Navegador       | Versión Mínima | Soporte        |
|-----------------|----------------|----------------|
| Chrome          | 90+            | ✅ Completo    |
| Firefox         | 88+            | ✅ Completo    |
| Safari          | 14+            | ✅ Completo    |
| Edge            | 90+            | ✅ Completo    |
| iOS Safari      | 14+            | ✅ Completo    |
| Android Chrome  | 90+            | ✅ Completo    |

---

## 🔍 SEO TÉCNICO

| Técnica          | Implementación                                       |
|------------------|------------------------------------------------------|
| Rendering        | SSR/SSG para todas las páginas indexables            |
| Meta tags        | Dinámicos por página (Metadata API Next / nuxt-seo) |
| Open Graph       | og:title, og:description, og:image en cada página   |
| Schema.org       | JSON-LD: Product, BreadcrumbList, BlogPosting, Org  |
| Sitemap          | Generación automática con rutas dinámicas            |
| robots.txt       | Configuración por entorno (dev/staging/prod)         |
| Canonical URLs   | Prevención de contenido duplicado                    |
| Core Web Vitals  | Optimización LCP, INP, CLS en CI/CD                 |
| Hreflang         | ES/EN para páginas internacionalizadas               |

---

## 🆓 POLÍTICA DE TECNOLOGÍAS — OPEN SOURCE O GRATUITAS (v35)

El proyecto usa **solo tecnologías open source o servicios con uso gratuito**. Se aplicó a las fases 0–4 ya implementadas; las fases futuras que hoy nombran servicios de pago quedan marcadas con ⚠️ para decidir antes de implementarlas.

| Tecnología | Licencia / costo | Estado |
|------------|------------------|--------|
| Node.js, Express, TypeScript, Prisma, Mongoose, ioredis, Zod, Passport, jsonwebtoken, bcrypt, Apollo Server, GraphQL, Socket.io, winston, Nodemailer, PDFKit, ethers, axios, multer, helmet, swagger-ui-express | Open source (MIT / Apache-2.0) | ✅ En uso |
| Next.js, React, next-auth, next-intl, TanStack Query, Redux Toolkit, Formik, Axios, Tailwind CSS, shadcn/ui + Radix UI, Framer Motion, socket.io-client | Open source (MIT / ISC) | ✅ En uso |
| PostgreSQL + pgvector, MongoDB Community, Redis, Docker, Turborepo, pnpm, Husky, commitlint, ESLint, Prettier, Jest | Open source / gratuitos | ✅ En uso |
| IPFS (Kubo), Polygon/Ethereum testnet | Open source / gratuitos en testnet | ✅ En uso |
| Stripe | Sin mensualidad (comisión solo por transacción real; modo test gratis); SDK MIT | ✅ En uso |
| Cloudinary, Firebase Cloud Messaging, OAuth de Google/GitHub/Discord | Servicios con plan gratuito | ✅ En uso |
| Auth0 | SaaS propietario | 🔄 Reemplazado por autenticación propia (JWT + OAuth2 + SIWE) |
| Algolia / ElasticSearch (búsqueda) | Algolia de pago | 🔄 Reemplazado por PostgreSQL FTS + pgvector |
| Azure (Key Vault, Application Insights, Communication Services, bases administradas) | De pago | 🔄 Opcional: `AZURE_ENABLED=false` por defecto; con `true` se usa Azure y, si falla, la alternativa gratuita (`.env`, logs, Nodemailer + SMTP, contenedores) |
| APIs FedEx/DHL | Requieren contrato | 🔄 Strategy con tarifas locales (Servientrega, DHL) |
| ipfs-http-client, web3.js, crate `web3`, Rasa | Obsoletos / duplicados / incompatibles con Python ≥ 3.11 | 🔄 Eliminados (ver guías de setup) |
| HubSpot, Vercel, Netlify, CloudFlare | Planes gratuitos con límites | ⚠️ Fases 6–11: válidos mientras se usen dentro del plan gratuito |

---

## 📐 PRINCIPIOS DE INGENIERÍA

### SOLID

| Principio   | Aplicación en el Proyecto                                                         |
|-------------|-----------------------------------------------------------------------------------|
| **S — SRP** | Un módulo = un dominio. Un controller = HTTP only. Un service = lógica de negocio|
| **O — OCP** | Strategy pattern para algoritmos ML. Factory para creación. Plugins para integraciones|
| **L — LSP** | Interfaces Repository sustituibles. Adapters intercambiables por proveedor        |
| **I — ISP** | Interfaces específicas por dominio (IProductRepository, no IGenericRepository)    |
| **D — DIP** | Controllers → interfaces Service. Services → interfaces Repository                |

### DRY (Don't Repeat Yourself)

- DTOs compartidos entre validación y documentación Swagger
- Schemas Zod/Pydantic como única fuente de verdad para tipos y validación
- Base repositories con operaciones genéricas extendibles por entidad
- Hooks y composables reutilizables en frontend (useAuth, useCart, useDebounce)
- Middlewares centralizados (auth, rate-limit, logger, error-handler)

### Clean Code

- Nombres descriptivos en inglés (código) + comentarios en español (negocio)
- Funciones ≤ 20 líneas, clases ≤ 200 líneas
- Sin magic strings/numbers → constantes tipadas exportadas
- Commits Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`

### TypeScript Strict — ES2022+

```jsonc
// tsconfig.json — Opciones obligatorias
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "exactOptionalPropertyTypes": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitReturns": true,
  "useUnknownInCatchVariables": true
}
```

---

## 🗓️ PLAN DE DESARROLLO (Resumen por Fases)

| Fase | Nombre                              | Servicios                                    | Semanas |
|------|-------------------------------------|----------------------------------------------|---------|
| 0 ✅ | Setup & Arquitectura Base           | Monorepo · Docker · DB · CI/CD               | 2       |
| 1 ✅ | Identity Domain                     | Express Auth/Users/Roles + Next Auth         | 3       |
| 2 ✅ | Product Catalog                     | Express Products/Cat/Brands + Next Storefront| 3       |
| 3 ✅ | Commerce Flow                       | Express Cart/Checkout/Orders/Pay + Next Commerce| 3    |
| 4 ✅ | Finance, Loyalty & Engagement       | Express Finance/Loyalty/Reviews + Next Account| 2     |
| 5    | FastAPI AI Engine (10 módulos ML)   | ML Predictions · CV · NLP · Fraud · Pricing | 4       |
| 5B   | FastAPI LLM Assistant (1 módulo)    | RAG · Tool use · SSE · Evaluación            | ~5 (fuera del total) |
| 6    | Social, Automation & AI FE          | Express Social/n8n/Comm + Next Social+AI Chat| 2     |
| 7    | Analytics, Admin & Integrations     | Express Analytics/Admin/Media + Next Admin   | 3       |
| 8    | Nuxt.js 3 (17 módulos)              | Landing · CMS · SEO · Social · PWA · Config  | 3       |
| 9    | Rust Axum HPC (6 módulos)           | Inventory · Analytics · Blockchain · Proxy · WS · Cache| 3|
| 10   | Integration, Testing & QA           | Jest · Playwright · k6 · Lighthouse · axe-core| 2     |
| 11   | Deployment & Launch                 | Kubernetes · GitHub Actions · Grafana · CloudFlare| 1  |
| **Total** | **12 fases · 27 sprints**      | **Todos los servicios**                      | **~27** |

> ⏱️ Estimación con equipo completo: **~27 semanas (6–7 meses)**
>
> ✅ = implementado en el código (v35). Verificado con `tsc` y ESLint en Express y Next, y con las pruebas unitarias de Express; queda pendiente probarlo contra una base de datos real, Docker y las pruebas E2E (Fase 10).

---

## 📁 ESTRUCTURA DE REPOSITORIOS

```
ecommerce-web3/                    # Monorepo raíz (Turborepo + pnpm)
├── apps/
│   ├── ecommerce-next/            # Next.js 15 — Storefront & Admin (32 módulos)
│   ├── ecommerce-nuxt/            # Nuxt — CMS, Landing & PWA (17 módulos)
│   ├── ecommerce-express/         # Express TS — Core Commerce (37 módulos)
│   ├── ecommerce-fastapi/         # FastAPI Python — AI Engine (11 módulos)
│   └── ecommerce-rust/            # Rust Axum — HPC Services (6 módulos)
├── packages/
│   ├── ui/                        # Design System compartido
│   ├── types/                     # Tipos TypeScript compartidos
│   ├── config/                    # ESLint, Prettier, TSConfig base
│   └── utils/                     # Utilidades compartidas
├── infra/
│   ├── docker/                    # docker-compose.dev.yml (el Dockerfile vive en cada app)
│   ├── k8s/                       # Kubernetes manifests
│   └── terraform/                 # Infraestructura como código
├── docs/                          # Documentación técnica
├── .github/
│   └── workflows/                 # GitHub Actions CI/CD pipelines
├── turbo.json                     # Turborepo pipeline config
└── pnpm-workspace.yaml            # Workspace packages
```

---

## 📊 MÉTRICAS DE ÉXITO

| KPI                        | Target                      | Herramienta                       |
|----------------------------|-----------------------------|-----------------------------------|
| Cobertura de pruebas       | ≥ 80%                       | Jest Coverage · pytest-cov        |
| Lighthouse Performance     | ≥ 90                        | Lighthouse CI en GitHub Actions   |
| Lighthouse Accessibility   | ≥ 90                        | Lighthouse CI + axe-core          |
| Lighthouse SEO             | ≥ 90                        | Lighthouse CI                     |
| API Response Time P95      | < 200ms                     | Grafana + k6                      |
| Rust HPC Latency P99       | < 10ms                      | criterion benchmarks              |
| Uptime SLA                 | ≥ 99.9%                     | Grafana Uptime monitoring         |
| Seguridad                  | 0 vulnerabilidades críticas  | OWASP ZAP + SonarQube            |
| WCAG 2.1 AA Compliance     | 100%                        | axe-core automated scan           |
| Bundle Size JS (Next.js)   | < 200KB gzipped inicial     | next bundle analyzer              |

---

## 📝 GLOSARIO

| Término  | Definición                                                  |
|----------|-------------------------------------------------------------|
| DOMA     | Domain-Oriented Modular Architecture                        |
| HTAP     | Hybrid Transactional/Analytical Processing                  |
| RSC      | React Server Component                                      |
| ISR      | Incremental Static Regeneration                             |
| FSD      | Feature-Sliced Design                                       |
| MCP      | Model Context Protocol                                      |
| RBAC     | Role-Based Access Control                                   |
| LTV      | Lifetime Value del cliente                                  |
| RFM      | Recency, Frequency, Monetary (análisis de clientes)        |
| NFT      | Non-Fungible Token                                          |
| PWA      | Progressive Web App                                         |
| ANN      | Approximate Nearest Neighbor                                |
| HNSW     | Hierarchical Navigable Small World (índice vectorial)       |
| RAG      | Retrieval-Augmented Generation                              |
| LLM      | Large Language Model                                        |
| WCAG     | Web Content Accessibility Guidelines                        |
| FOUT     | Flash of Unstyled Text                                      |
| TTFB     | Time to First Byte                                          |
| LCP      | Largest Contentful Paint                                    |
| INP      | Interaction to Next Paint                                   |
| CLS      | Cumulative Layout Shift                                     |
| OWASP    | Open Web Application Security Project                       |
| SLA      | Service Level Agreement                                     |
| i18n     | Internationalization                                        |
| a11y     | Accessibility                                               |
