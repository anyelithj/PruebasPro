# 📱 Frontend Next.js 15 — Guía de Creación desde Cero (Git Bash + pnpm)

> Proyecto: **ecommerce-next** · Basado en `04_NEXTJS15.md`, `ecommerce_matriz_trazabilidad_v34.xlsx` (hoja "📱 Next.js 15") y `ESPECIFICACION_TECNICA_UNIFICADA.md`.

✅ **Decisión de estado (03/10/2026):** **TanStack Query** para el Server State (datos del backend) y **Redux Toolkit** para el Client State (UI global), de forma complementaria; **Formik + Zod** para formularios y **Axios** como cliente HTTP. Redux Toolkit **reemplaza a Zustand** (desinstalado). Reglas completas en `04_NEXTJS15.md`, sección "Gestión de estado". UI: shadcn/ui + Radix + Tailwind (Material UI y Sass descartados).

> **Actualización v35 — política open source / gratuita:** todo el stack instalado es open source (MIT/ISC/Apache). Las secciones marcadas con 🔄 cambiaron respecto a la versión anterior de esta guía y las marcadas con ⏳ aún no se instalan porque su módulo pertenece a una fase posterior o está pendiente de decisión. El estado real está en la sección **5**.

---

## 0. Prerrequisitos (Git Bash)

```bash
node -v        # Node 20+
pnpm -v
```

---

## 1. Crear el proyecto desde cero

```bash
pnpm create next-app@latest ecommerce-next --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
cd ecommerce-next
```

---

## 2. Instalar dependencias (pnpm)

### 2.1 State management y data fetching

```bash
pnpm add @tanstack/react-query          # Server State: useQuery (lecturas) / useMutation (escrituras)
pnpm add @reduxjs/toolkit react-redux   # Client State: slices en features/*/model/*.store.ts
pnpm add axios                          # Cliente HTTP (shared/lib/api-client.ts)
```

🔄 Redux Toolkit reemplaza a Zustand: el store se arma en `app/[locale]/providers.tsx` con `combineSlices` y `shared/lib/store.ts` aporta `createSliceHook` y la persistencia (sin librerías extra).

### 2.2 UI — shadcn/ui (Radix UI + Tailwind, se instalan como código fuente, no como paquete)

```bash
pnpm dlx shadcn@latest init
pnpm add framer-motion
```

> `shadcn@latest add button dialog table ...` se ejecuta por componente cuando lo necesites; internamente trae las dependencias `@radix-ui/*` correspondientes.
>
> ✅ **Estado (v35):** `shared/ui` usa **shadcn/ui sobre Radix UI** (decisión aprobada; se descartó Material UI porque sus estilos con Emotion obligan a componentes de cliente, suman ~100 KB de JS y duplican el sistema de estilos de Tailwind). `components.json` apunta los alias de shadcn a la estructura FSD (`@/shared/ui`, `@/shared/lib/cn`), así `pnpm dlx shadcn@latest add <componente>` genera directo en `shared/ui`. Dependencias instaladas (todas MIT):
>
> ```bash
> pnpm add class-variance-authority clsx tailwind-merge@^2 @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-toast @radix-ui/react-label
> pnpm add -D tailwindcss-animate
> ```
>
> `tailwind-merge` se fija en v2 porque el proyecto usa Tailwind 3.4 (la v3 es para Tailwind 4). Los tokens de color (`--primary`, `--muted`...) viven en `app/globals.css` con contraste AA verificado. `framer-motion` también está instalado.

### 2.3 Formularios y validación 🔄

```bash
pnpm add formik zod
```

🔄 **Formik + Zod** (como indica la especificación; reemplaza a react-hook-form, que se desinstaló para no tener dos librerías de formularios). Todos los formularios usan el hook compartido `shared/hook/useZodForm.ts`:

- `zodValidate(schema)` adapta los errores de Zod al formato de Formik (patrón Adapter); los mensajes siguen siendo claves de traducción.
- `onSubmit` recibe los valores **ya transformados** por Zod (`trim`, `toUpperCase`, `""` → `undefined`).
- `form.getFieldProps("campo")` conecta el `<Input>` y `form.error("campo")` muestra el error solo si el campo ya se visitó o se intentó enviar.

### 2.4 Autenticación

```bash
pnpm add next-auth@beta
```

### 2.5 GraphQL (Apollo Client) — ⏳ no instalado

```bash
# pnpm add @apollo/client graphql
```

> ⏳ Las fases 0–4 consumen la API **REST** de Express con `fetch` nativo + **TanStack Query** (cache, reintentos, mutaciones optimistas). Apollo Client duplicaría la cache de TanStack Query. El endpoint `/graphql` de Express (catálogo) ya existe; Apollo Client se agrega solo si una pantalla lo necesita.

### 2.6 Pagos

```bash
pnpm add @stripe/stripe-js @stripe/react-stripe-js
```

> 🔄 **PayPal eliminado:** la matriz (hoja Express, `POST /api/v1/payment/process`) define a **Stripe como PSP exclusivo del proyecto**. Stripe no cobra mensualidad (solo comisión por transacción real) y su modo test es gratuito; los SDK son MIT.

### 2.7 Internacionalización (next-intl) — ✅ implementado

```bash
pnpm add next-intl
```

> ✅ **Estado (v35):** español (por defecto, **sin prefijo**: `/products`) e inglés (`/en/products`). Las rutas viven en `app/[locale]/...` (los route groups `(storefront)`, `(auth)`... se conservan dentro); `api/`, `sitemap.ts` y `robots.ts` quedan fuera. Piezas:
> - `shared/lib/i18n/routing.ts` (idiomas, cookie `NEXT_LOCALE`), `navigation.ts` (`Link`/`useRouter`/`redirect` con idioma), `request.ts` (carga solo el diccionario del idioma), `server.ts` (`initPage` para render estático por idioma y `alternates()` para canonical + **hreflang**).
> - `middleware.ts` encadena el guard de autenticación y el middleware de next-intl (el login conserva el idioma).
> - 627 mensajes por idioma en `messages/{es,en}.json`, con plurales ICU; los mensajes de validación Zod son claves que traduce `Input`; los errores del backend se traducen por su `code` (`useErrorMessage`).
> - `pnpm i18n:check` (también en CI) valida que ambos idiomas tengan las mismas claves, ICU válido y las mismas variables.
> - Selector de idioma en el pie de página y en Ajustes. `sitemap.xml` publica cada URL en ambos idiomas con `hreflang`.
>
> Los textos que genera el **backend** también se traducen: `api-client` envía `Accept-Language` con el idioma de la interfaz y el backend redacta notificaciones y conceptos de puntos en ese idioma; los emails y el push usan el idioma preferido guardado en el perfil (se actualiza al registrarse y con el selector de idioma).

### 2.8 Tiempo real

```bash
pnpm add socket.io-client
```

### 2.9 Visualización de datos (dashboards admin) — ⏳ Fase 7

```bash
pnpm add chart.js react-chartjs-2 d3
```

### 2.10 Medios (Cloudinary)

```bash
# no se instala paquete extra
```

> 🔄 **`next-cloudinary` no se usa:** el backend entrega URLs de Cloudinary ya optimizadas (`f_auto`, `q_auto`) y el frontend las muestra con `next/image` (dominio autorizado en `next.config.ts` → `images.remotePatterns`). La subida pasa por `POST /api/v1/media/upload` del backend (las credenciales nunca llegan al navegador).

### 2.11 Web3

```bash
# no se instala paquete extra en las fases 0–4
```

> 🔄 **`wagmi` + `viem` no se instalan todavía:** el login con wallet (Sign-In With Ethereum) y la vinculación de wallet solo necesitan pedir la cuenta y una firma, lo que el estándar **EIP-1193** (`window.ethereum`, MetaMask/Rabby/Coinbase Wallet) resuelve sin dependencias (`shared/lib/wallet.ts`). La firma la verifica el backend con `ethers`. `wagmi` + `viem` (MIT) se agregarán cuando haya pagos cripto en el frontend.

### 2.12 Cliente HTTP genérico

```bash
# no se instala: se usa fetch nativo
```

> 🔄 **`axios` no se usa en Next:** `shared/lib/api-client.ts` usa `fetch` nativo porque es el único cliente que integra la cache de Next.js (`next: { revalidate, tags }` → ISR). Un único cliente HTTP en toda la app (DRY).

### 2.13 Testing — ⏳ Fase 10

```bash
pnpm add -D jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom @playwright/test
pnpm dlx playwright install
```

### 2.14 Análisis de bundle (performance) — ⏳ Fase 10

```bash
pnpm add -D @next/bundle-analyzer
```

---

## 3. Crear la estructura completa de carpetas y archivos

> Generado automáticamente a partir del árbol exacto de `04_NEXTJS15.md` (31 módulos, App Router). `create-next-app` ya crea algunos archivos base (`app/`, `next.config.ts`, etc.); estos comandos son idempotentes (`mkdir -p` no falla si la carpeta ya existe) y completan el resto de la estructura de módulos.

```bash
mkdir -p \
  "ecommerce-next/app" \
  "ecommerce-next/app/(auth)" \
  "ecommerce-next/app/(auth)/login" \
  "ecommerce-next/app/(auth)/register" \
  "ecommerce-next/app/(auth)/verify" \
  "ecommerce-next/app/(auth)/verify/[token]" \
  "ecommerce-next/app/(auth)/forgot-password" \
  "ecommerce-next/app/(storefront)" \
  "ecommerce-next/app/(storefront)/products" \
  "ecommerce-next/app/(storefront)/products/[id]" \
  "ecommerce-next/app/(storefront)/categories" \
  "ecommerce-next/app/(storefront)/categories/[slug]" \
  "ecommerce-next/app/(storefront)/brands" \
  "ecommerce-next/app/(storefront)/brands/[slug]" \
  "ecommerce-next/app/(storefront)/collections" \
  "ecommerce-next/app/(storefront)/collections/[slug]" \
  "ecommerce-next/app/(storefront)/search" \
  "ecommerce-next/app/(commerce)" \
  "ecommerce-next/app/(commerce)/cart" \
  "ecommerce-next/app/(commerce)/checkout" \
  "ecommerce-next/app/(commerce)/checkout/[id]" \
  "ecommerce-next/app/(commerce)/checkout/[id]/address" \
  "ecommerce-next/app/(commerce)/checkout/[id]/payment" \
  "ecommerce-next/app/(commerce)/checkout/[id]/confirm" \
  "ecommerce-next/app/(commerce)/checkout/success" \
  "ecommerce-next/app/(account)" \
  "ecommerce-next/app/(account)/account" \
  "ecommerce-next/app/(account)/account/orders" \
  "ecommerce-next/app/(account)/account/orders/[id]" \
  "ecommerce-next/app/(account)/account/wishlist" \
  "ecommerce-next/app/(account)/account/reviews" \
  "ecommerce-next/app/(account)/account/addresses" \
  "ecommerce-next/app/(account)/account/loyalty" \
  "ecommerce-next/app/(account)/account/notifications" \
  "ecommerce-next/app/(account)/account/settings" \
  "ecommerce-next/app/(admin)" \
  "ecommerce-next/app/(admin)/dashboard" \
  "ecommerce-next/app/(admin)/dashboard/analytics" \
  "ecommerce-next/app/(admin)/dashboard/products" \
  "ecommerce-next/app/(admin)/dashboard/products/new" \
  "ecommerce-next/app/(admin)/dashboard/products/[id]" \
  "ecommerce-next/app/(admin)/dashboard/products/[id]/edit" \
  "ecommerce-next/app/(admin)/dashboard/orders" \
  "ecommerce-next/app/(admin)/dashboard/customers" \
  "ecommerce-next/app/(admin)/dashboard/inventory" \
  "ecommerce-next/app/(admin)/dashboard/media" \
  "ecommerce-next/app/(admin)/dashboard/marketing" \
  "ecommerce-next/app/(admin)/dashboard/settings" \
  "ecommerce-next/app/(ai)" \
  "ecommerce-next/app/(ai)/chat" \
  "ecommerce-next/app/(ai)/recommendations" \
  "ecommerce-next/app/(social)" \
  "ecommerce-next/app/(social)/social" \
  "ecommerce-next/app/(social)/social/[id]" \
  "ecommerce-next/app/(social)/influencers" \
  "ecommerce-next/app/api" \
  "ecommerce-next/app/api/auth" \
  "ecommerce-next/app/api/auth/[...nextauth]" \
  "ecommerce-next/app/api/webhooks" \
  "ecommerce-next/app/api/webhooks/stripe" \
  "ecommerce-next/app/api/webhooks/inventory" \
  "ecommerce-next/app/api/revalidate" \
  "ecommerce-next/features" \
  "ecommerce-next/features/auth" \
  "ecommerce-next/features/auth/ui" \
  "ecommerce-next/features/auth/model" \
  "ecommerce-next/features/auth/api" \
  "ecommerce-next/features/auth/lib" \
  "ecommerce-next/features/product" \
  "ecommerce-next/features/product/ui" \
  "ecommerce-next/features/product/model" \
  "ecommerce-next/features/product/api" \
  "ecommerce-next/features/product/lib" \
  "ecommerce-next/features/cart" \
  "ecommerce-next/features/cart/ui" \
  "ecommerce-next/features/cart/model" \
  "ecommerce-next/features/cart/api" \
  "ecommerce-next/features/cart/lib" \
  "ecommerce-next/features/checkout" \
  "ecommerce-next/features/checkout/ui" \
  "ecommerce-next/features/checkout/model" \
  "ecommerce-next/features/checkout/api" \
  "ecommerce-next/features/checkout/lib" \
  "ecommerce-next/features/order" \
  "ecommerce-next/features/order/ui" \
  "ecommerce-next/features/order/model" \
  "ecommerce-next/features/order/api" \
  "ecommerce-next/features/order/lib" \
  "ecommerce-next/features/payment" \
  "ecommerce-next/features/payment/ui" \
  "ecommerce-next/features/payment/model" \
  "ecommerce-next/features/payment/api" \
  "ecommerce-next/features/payment/lib" \
  "ecommerce-next/features/search" \
  "ecommerce-next/features/search/ui" \
  "ecommerce-next/features/search/model" \
  "ecommerce-next/features/search/api" \
  "ecommerce-next/features/search/lib" \
  "ecommerce-next/features/review" \
  "ecommerce-next/features/review/ui" \
  "ecommerce-next/features/review/model" \
  "ecommerce-next/features/review/api" \
  "ecommerce-next/features/review/lib" \
  "ecommerce-next/features/loyalty" \
  "ecommerce-next/features/loyalty/ui" \
  "ecommerce-next/features/loyalty/model" \
  "ecommerce-next/features/loyalty/api" \
  "ecommerce-next/features/loyalty/lib" \
  "ecommerce-next/features/notification" \
  "ecommerce-next/features/notification/ui" \
  "ecommerce-next/features/notification/model" \
  "ecommerce-next/features/notification/api" \
  "ecommerce-next/features/notification/lib" \
  "ecommerce-next/features/ai-chat" \
  "ecommerce-next/features/ai-chat/ui" \
  "ecommerce-next/features/ai-chat/model" \
  "ecommerce-next/features/ai-chat/api" \
  "ecommerce-next/features/ai-chat/lib" \
  "ecommerce-next/features/social-commerce" \
  "ecommerce-next/features/social-commerce/ui" \
  "ecommerce-next/features/social-commerce/model" \
  "ecommerce-next/features/social-commerce/api" \
  "ecommerce-next/features/social-commerce/lib" \
  "ecommerce-next/features/admin-dashboard" \
  "ecommerce-next/features/admin-dashboard/ui" \
  "ecommerce-next/features/admin-dashboard/model" \
  "ecommerce-next/features/admin-dashboard/api" \
  "ecommerce-next/features/admin-dashboard/lib" \
  "ecommerce-next/features/media" \
  "ecommerce-next/features/media/ui" \
  "ecommerce-next/features/media/model" \
  "ecommerce-next/features/media/api" \
  "ecommerce-next/features/media/lib" \
  "ecommerce-next/features/settings" \
  "ecommerce-next/features/settings/ui" \
  "ecommerce-next/features/settings/model" \
  "ecommerce-next/features/settings/api" \
  "ecommerce-next/features/settings/lib" \
  "ecommerce-next/widgets" \
  "ecommerce-next/widgets/auth" \
  "ecommerce-next/widgets/product" \
  "ecommerce-next/widgets/cart" \
  "ecommerce-next/widgets/navigation" \
  "ecommerce-next/widgets/loyalty" \
  "ecommerce-next/widgets/analytics" \
  "ecommerce-next/entities" \
  "ecommerce-next/entities/product" \
  "ecommerce-next/entities/product/ui" \
  "ecommerce-next/entities/product/model" \
  "ecommerce-next/entities/user" \
  "ecommerce-next/entities/user/ui" \
  "ecommerce-next/entities/user/model" \
  "ecommerce-next/entities/order" \
  "ecommerce-next/entities/order/model" \
  "ecommerce-next/entities/cart" \
  "ecommerce-next/entities/cart/model" \
  "ecommerce-next/shared" \
  "ecommerce-next/shared/ui" \
  "ecommerce-next/shared/hook" \
  "ecommerce-next/shared/lib" \
  "ecommerce-next/shared/types" \
  "ecommerce-next/shared/constants" \
  "ecommerce-next/public" \
  "ecommerce-next/public/icons" \
  "ecommerce-next/public/images" \
  "ecommerce-next/public/fonts" \
  "ecommerce-next/messages" \
  "ecommerce-next"

touch \
  "ecommerce-next/app/(auth)/login/page.tsx" \
  "ecommerce-next/app/(auth)/register/page.tsx" \
  "ecommerce-next/app/(auth)/verify/[token]/page.tsx" \
  "ecommerce-next/app/(auth)/forgot-password/page.tsx" \
  "ecommerce-next/app/(auth)/layout.tsx" \
  "ecommerce-next/app/(storefront)/page.tsx" \
  "ecommerce-next/app/(storefront)/products/page.tsx" \
  "ecommerce-next/app/(storefront)/products/[id]/page.tsx" \
  "ecommerce-next/app/(storefront)/categories/[slug]/page.tsx" \
  "ecommerce-next/app/(storefront)/brands/[slug]/page.tsx" \
  "ecommerce-next/app/(storefront)/collections/[slug]/page.tsx" \
  "ecommerce-next/app/(storefront)/search/page.tsx" \
  "ecommerce-next/app/(storefront)/layout.tsx" \
  "ecommerce-next/app/(commerce)/cart/page.tsx" \
  "ecommerce-next/app/(commerce)/checkout/page.tsx" \
  "ecommerce-next/app/(commerce)/checkout/[id]/address/page.tsx" \
  "ecommerce-next/app/(commerce)/checkout/[id]/payment/page.tsx" \
  "ecommerce-next/app/(commerce)/checkout/[id]/confirm/page.tsx" \
  "ecommerce-next/app/(commerce)/checkout/success/page.tsx" \
  "ecommerce-next/app/(commerce)/layout.tsx" \
  "ecommerce-next/app/(account)/account/page.tsx" \
  "ecommerce-next/app/(account)/account/orders/page.tsx" \
  "ecommerce-next/app/(account)/account/orders/[id]/page.tsx" \
  "ecommerce-next/app/(account)/account/wishlist/page.tsx" \
  "ecommerce-next/app/(account)/account/reviews/page.tsx" \
  "ecommerce-next/app/(account)/account/addresses/page.tsx" \
  "ecommerce-next/app/(account)/account/loyalty/page.tsx" \
  "ecommerce-next/app/(account)/account/notifications/page.tsx" \
  "ecommerce-next/app/(account)/account/settings/page.tsx" \
  "ecommerce-next/app/(account)/layout.tsx" \
  "ecommerce-next/app/(admin)/dashboard/page.tsx" \
  "ecommerce-next/app/(admin)/dashboard/analytics/page.tsx" \
  "ecommerce-next/app/(admin)/dashboard/products/page.tsx" \
  "ecommerce-next/app/(admin)/dashboard/products/new/page.tsx" \
  "ecommerce-next/app/(admin)/dashboard/products/[id]/edit/page.tsx" \
  "ecommerce-next/app/(admin)/dashboard/orders/page.tsx" \
  "ecommerce-next/app/(admin)/dashboard/customers/page.tsx" \
  "ecommerce-next/app/(admin)/dashboard/inventory/page.tsx" \
  "ecommerce-next/app/(admin)/dashboard/media/page.tsx" \
  "ecommerce-next/app/(admin)/dashboard/marketing/page.tsx" \
  "ecommerce-next/app/(admin)/dashboard/settings/page.tsx" \
  "ecommerce-next/app/(admin)/layout.tsx" \
  "ecommerce-next/app/(ai)/chat/page.tsx" \
  "ecommerce-next/app/(ai)/recommendations/page.tsx" \
  "ecommerce-next/app/(social)/social/page.tsx" \
  "ecommerce-next/app/(social)/social/[id]/page.tsx" \
  "ecommerce-next/app/(social)/influencers/page.tsx" \
  "ecommerce-next/app/api/auth/[...nextauth]/route.ts" \
  "ecommerce-next/app/api/webhooks/stripe/route.ts" \
  "ecommerce-next/app/api/webhooks/inventory/route.ts" \
  "ecommerce-next/app/api/revalidate/route.ts" \
  "ecommerce-next/app/layout.tsx" \
  "ecommerce-next/app/not-found.tsx" \
  "ecommerce-next/app/error.tsx" \
  "ecommerce-next/app/loading.tsx" \
  "ecommerce-next/features/auth/ui/LoginForm.tsx" \
  "ecommerce-next/features/auth/ui/RegisterForm.tsx" \
  "ecommerce-next/features/auth/ui/OAuthButtons.tsx" \
  "ecommerce-next/features/auth/ui/ForgotPasswordForm.tsx" \
  "ecommerce-next/features/auth/ui/VerifyEmailForm.tsx" \
  "ecommerce-next/features/auth/ui/UpdatePasswordForm.tsx" \
  "ecommerce-next/features/auth/model/auth.store.ts" \
  "ecommerce-next/features/auth/api/auth.api.ts" \
  "ecommerce-next/features/auth/lib/auth.validator.ts" \
  "ecommerce-next/features/product/ui/ProductCard.tsx" \
  "ecommerce-next/features/product/ui/ProductGrid.tsx" \
  "ecommerce-next/features/product/ui/ProductFilters.tsx" \
  "ecommerce-next/features/product/ui/ProductGallery.tsx" \
  "ecommerce-next/features/product/ui/ProductVariants.tsx" \
  "ecommerce-next/features/product/ui/ProductReviews.tsx" \
  "ecommerce-next/features/product/ui/AddToCartButton.tsx" \
  "ecommerce-next/features/product/model/product.store.ts" \
  "ecommerce-next/features/product/api/product.api.ts" \
  "ecommerce-next/features/product/lib/product.validator.ts" \
  "ecommerce-next/features/cart/ui/CartDrawer.tsx" \
  "ecommerce-next/features/cart/ui/CartItem.tsx" \
  "ecommerce-next/features/cart/ui/CartSummary.tsx" \
  "ecommerce-next/features/cart/ui/CartEmpty.tsx" \
  "ecommerce-next/features/cart/ui/CartBadge.tsx" \
  "ecommerce-next/features/cart/model/cart.store.ts" \
  "ecommerce-next/features/cart/api/cart.api.ts" \
  "ecommerce-next/features/cart/lib/cart.validator.ts" \
  "ecommerce-next/features/checkout/ui/CheckoutStepper.tsx" \
  "ecommerce-next/features/checkout/ui/AddressForm.tsx" \
  "ecommerce-next/features/checkout/ui/PaymentForm.tsx" \
  "ecommerce-next/features/checkout/ui/OrderSummary.tsx" \
  "ecommerce-next/features/checkout/ui/ConfirmButton.tsx" \
  "ecommerce-next/features/checkout/model/checkout.store.ts" \
  "ecommerce-next/features/checkout/api/checkout.api.ts" \
  "ecommerce-next/features/checkout/lib/checkout.validator.ts" \
  "ecommerce-next/features/order/ui/OrderList.tsx" \
  "ecommerce-next/features/order/ui/OrderCard.tsx" \
  "ecommerce-next/features/order/ui/OrderDetail.tsx" \
  "ecommerce-next/features/order/ui/OrderStatus.tsx" \
  "ecommerce-next/features/order/ui/OrderTracking.tsx" \
  "ecommerce-next/features/order/model/order.store.ts" \
  "ecommerce-next/features/order/api/order.api.ts" \
  "ecommerce-next/features/order/lib/order.validator.ts" \
  "ecommerce-next/features/payment/ui/StripePayment.tsx" \
  "ecommerce-next/features/payment/ui/PaymentStatus.tsx" \
  "ecommerce-next/features/payment/ui/PaymentHistory.tsx" \
  "ecommerce-next/features/payment/model/payment.store.ts" \
  "ecommerce-next/features/payment/api/payment.api.ts" \
  "ecommerce-next/features/payment/lib/payment.validator.ts" \
  "ecommerce-next/features/search/ui/SearchBar.tsx" \
  "ecommerce-next/features/search/ui/SearchResults.tsx" \
  "ecommerce-next/features/search/ui/SearchFilters.tsx" \
  "ecommerce-next/features/search/ui/SearchSuggestions.tsx" \
  "ecommerce-next/features/search/ui/ImageSearch.tsx" \
  "ecommerce-next/features/search/model/search.store.ts" \
  "ecommerce-next/features/search/api/search.api.ts" \
  "ecommerce-next/features/search/lib/search.validator.ts" \
  "ecommerce-next/features/review/ui/ReviewForm.tsx" \
  "ecommerce-next/features/review/ui/ReviewList.tsx" \
  "ecommerce-next/features/review/ui/StarRating.tsx" \
  "ecommerce-next/features/review/ui/ReviewSummary.tsx" \
  "ecommerce-next/features/review/model/review.store.ts" \
  "ecommerce-next/features/review/api/review.api.ts" \
  "ecommerce-next/features/review/lib/review.validator.ts" \
  "ecommerce-next/features/loyalty/ui/PointsBalance.tsx" \
  "ecommerce-next/features/loyalty/ui/NFTBadgeGallery.tsx" \
  "ecommerce-next/features/loyalty/ui/RewardsHistory.tsx" \
  "ecommerce-next/features/loyalty/ui/LoyaltyTiers.tsx" \
  "ecommerce-next/features/loyalty/model/loyalty.store.ts" \
  "ecommerce-next/features/loyalty/api/loyalty.api.ts" \
  "ecommerce-next/features/loyalty/lib/loyalty.validator.ts" \
  "ecommerce-next/features/notification/ui/NotificationBell.tsx" \
  "ecommerce-next/features/notification/ui/NotificationList.tsx" \
  "ecommerce-next/features/notification/ui/NotificationToast.tsx" \
  "ecommerce-next/features/notification/model/notification.store.ts" \
  "ecommerce-next/features/notification/api/notification.api.ts" \
  "ecommerce-next/features/notification/lib/notification.validator.ts" \
  "ecommerce-next/features/ai-chat/ui/ChatWindow.tsx" \
  "ecommerce-next/features/ai-chat/ui/ChatMessage.tsx" \
  "ecommerce-next/features/ai-chat/ui/ChatInput.tsx" \
  "ecommerce-next/features/ai-chat/ui/AITypingIndicator.tsx" \
  "ecommerce-next/features/ai-chat/model/chat.store.ts" \
  "ecommerce-next/features/ai-chat/api/chat.api.ts" \
  "ecommerce-next/features/ai-chat/lib/chat.validator.ts" \
  "ecommerce-next/features/social-commerce/ui/SocialFeed.tsx" \
  "ecommerce-next/features/social-commerce/ui/SocialPost.tsx" \
  "ecommerce-next/features/social-commerce/ui/InfluencerProfile.tsx" \
  "ecommerce-next/features/social-commerce/ui/SocialShare.tsx" \
  "ecommerce-next/features/social-commerce/model/social.store.ts" \
  "ecommerce-next/features/social-commerce/api/social.api.ts" \
  "ecommerce-next/features/social-commerce/lib/social.validator.ts" \
  "ecommerce-next/features/admin-dashboard/ui/KPICard.tsx" \
  "ecommerce-next/features/admin-dashboard/ui/SalesChart.tsx" \
  "ecommerce-next/features/admin-dashboard/ui/DataTable.tsx" \
  "ecommerce-next/features/admin-dashboard/ui/AdminSidebar.tsx" \
  "ecommerce-next/features/admin-dashboard/model/dashboard.store.ts" \
  "ecommerce-next/features/admin-dashboard/api/dashboard.api.ts" \
  "ecommerce-next/features/admin-dashboard/lib/dashboard.validator.ts" \
  "ecommerce-next/features/media/ui/MediaUploader.tsx" \
  "ecommerce-next/features/media/ui/MediaGrid.tsx" \
  "ecommerce-next/features/media/ui/MediaPreview.tsx" \
  "ecommerce-next/features/media/model/media.store.ts" \
  "ecommerce-next/features/media/api/media.api.ts" \
  "ecommerce-next/features/media/lib/media.validator.ts" \
  "ecommerce-next/features/settings/ui/ProfileSettings.tsx" \
  "ecommerce-next/features/settings/ui/SecuritySettings.tsx" \
  "ecommerce-next/features/settings/ui/NotifSettings.tsx" \
  "ecommerce-next/features/settings/ui/ThemeSettings.tsx" \
  "ecommerce-next/features/settings/model/settings.store.ts" \
  "ecommerce-next/features/settings/api/settings.api.ts" \
  "ecommerce-next/features/settings/lib/settings.validator.ts" \
  "ecommerce-next/widgets/auth/AuthBanner.tsx" \
  "ecommerce-next/widgets/auth/UserMenu.tsx" \
  "ecommerce-next/widgets/product/FeaturedProducts.tsx" \
  "ecommerce-next/widgets/product/ProductCarousel.tsx" \
  "ecommerce-next/widgets/product/RecommendedProducts.tsx" \
  "ecommerce-next/widgets/cart/MiniCart.tsx" \
  "ecommerce-next/widgets/navigation/Header.tsx" \
  "ecommerce-next/widgets/navigation/Footer.tsx" \
  "ecommerce-next/widgets/navigation/MegaMenu.tsx" \
  "ecommerce-next/widgets/navigation/MobileNav.tsx" \
  "ecommerce-next/widgets/loyalty/PointsBanner.tsx" \
  "ecommerce-next/widgets/analytics/AnalyticsTracker.tsx" \
  "ecommerce-next/entities/product/ui/ProductImage.tsx" \
  "ecommerce-next/entities/product/model/product.types.ts" \
  "ecommerce-next/entities/user/ui/Avatar.tsx" \
  "ecommerce-next/entities/user/model/user.types.ts" \
  "ecommerce-next/entities/order/model/order.types.ts" \
  "ecommerce-next/entities/cart/model/cart.types.ts" \
  "ecommerce-next/shared/ui/Button.tsx" \
  "ecommerce-next/shared/ui/Input.tsx" \
  "ecommerce-next/shared/ui/Modal.tsx" \
  "ecommerce-next/shared/ui/Toast.tsx" \
  "ecommerce-next/shared/ui/Skeleton.tsx" \
  "ecommerce-next/shared/ui/Badge.tsx" \
  "ecommerce-next/shared/ui/Pagination.tsx" \
  "ecommerce-next/shared/ui/EmptyState.tsx" \
  "ecommerce-next/shared/ui/ErrorBoundary.tsx" \
  "ecommerce-next/shared/hook/useAuth.ts" \
  "ecommerce-next/shared/hook/useCart.ts" \
  "ecommerce-next/shared/hook/useMediaQuery.ts" \
  "ecommerce-next/shared/hook/useDebounce.ts" \
  "ecommerce-next/shared/hook/useIntersection.ts" \
  "ecommerce-next/shared/hook/useWebSocket.ts" \
  "ecommerce-next/shared/lib/api-client.ts" \
  "ecommerce-next/shared/lib/query-client.ts" \
  "ecommerce-next/shared/lib/auth-config.ts" \
  "ecommerce-next/shared/lib/cn.ts" \
  "ecommerce-next/shared/lib/format.ts" \
  "ecommerce-next/shared/lib/analytics.ts" \
  "ecommerce-next/shared/types/api.types.ts" \
  "ecommerce-next/shared/types/common.types.ts" \
  "ecommerce-next/shared/types/next.types.ts" \
  "ecommerce-next/shared/constants/routes.ts" \
  "ecommerce-next/shared/constants/config.ts" \
  "ecommerce-next/messages/es.json" \
  "ecommerce-next/messages/en.json" \
  "ecommerce-next/.env.local" \
  "ecommerce-next/.env.example" \
  "ecommerce-next/next.config.ts" \
  "ecommerce-next/tailwind.config.ts" \
  "ecommerce-next/tsconfig.json" \
  "ecommerce-next/middleware.ts" \
  "ecommerce-next/package.json"
```

---

## 4. Levantar el proyecto

```bash
pnpm dev
```

---

## 5. Estado de implementación (Fases 0–4)

| Fase | Módulos Next.js (FSD) | Estado |
|------|-----------------------|--------|
| 1.3 | `(auth)`: login en 2 pasos (2FA), registro, recuperación, verificación de email, OAuth2 (Google/GitHub/Discord), **login con wallet (SIWE)**; `middleware.ts` protege `/account`, `/checkout`, `/cart` | ✅ |
| 2.2 | `(storefront)`: home, catálogo con filtros en la URL, ficha de producto (ISR 60 s + JSON-LD Product), categorías (JSON-LD BreadcrumbList), marcas, colecciones; `sitemap.xml`, `robots.txt`, revalidación ISR bajo demanda (`/api/revalidate`) | ✅ |
| 2.3 | Búsqueda: barra con autocompletado accesible (combobox ARIA), facetas, historial, búsqueda por imagen | ✅ (la imagen requiere el endpoint de visión de FastAPI, Fase 5) |
| 3.3 | `(commerce)`: carrito (página + drawer), checkout en 3 pasos (envío → pago Stripe Elements → confirmación), pedidos | ✅ |
| 4.3 | `(account)`: resumen, pedidos y detalle (tracking, factura PDF, cancelación, reembolso), wishlist, reseñas, fidelidad + NFT, direcciones, notificaciones, ajustes (perfil, seguridad, wallet, notificaciones, visualización) | ✅ |

Decisiones resueltas en v35:

| Tema | Documento | Implementado |
|------|-----------|--------------|
| i18n | `next-intl`, ES/EN, hreflang | ✅ next-intl con rutas por idioma (`/` es, `/en` en), hreflang y sitemap multilingüe |
| UI base | shadcn/ui + Radix | ✅ shadcn/ui + Radix (Material UI descartado: ver 2.2) |
| GraphQL cliente | Apollo Client | REST + TanStack Query (Apollo solo si una pantalla lo exige) |

Verificado con `next build` (70 páginas estáticas, ambos idiomas) y peticiones reales a `next start`: `lang` correcto, textos por idioma, canonical/hreflang por página, redirecciones del guard conservando `/en` y estado HTTP 404 real para productos, categorías y rutas de fases futuras.

Las páginas de fases futuras (`(admin)`, `(ai)`, `(social)`) eran archivos vacíos que impedían `next build`; ahora responden **404** hasta implementar su fase. `app/[locale]/loading.tsx` se movió a `(account)` y `(commerce)`: a nivel global activaba streaming en todo el sitio y `notFound()` respondía 200 (soft-404).

Archivos agregados que no estaban en el árbol de `04_NEXTJS15.md`: `app/_components/{SiteChrome,JsonLd}.tsx` (chrome común y datos estructurados), vistas cliente junto a su página (`SearchView`, `CartView`, `CheckoutStepView`, `AccountNav`, `AccountOverview`, `WishlistView`, `AddressBook`), `app/sitemap.ts`, `app/robots.ts`, `app/error.tsx`, `app/loading.tsx`, `app/not-found.tsx`, `entities/*/api/*.api.ts` (datos compartidos entre features sin imports cruzados) y `shared/lib/wallet.ts`.

`app/api/webhooks/stripe/route.ts` responde **410 Gone**: el webhook de Stripe lo recibe **Express** (`POST /webhook/payment/stripe`, verificación de firma con el cuerpo crudo). Tener dos receptores del mismo evento duplicaría la lógica de pagos.
