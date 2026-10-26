# 📱 FRONTEND — Next.js 15
## eCommerce Web3 Enterprise · FSD Feature-Sliced Design · 31 Módulos
## App Router · RSC · SSR · SSG · ISR · TanStack Query · Redux Toolkit · Axios · Formik · Zod · Tailwind CSS · Stripe · TypeScript strict

---

```
ecommerce-next/
├── app/                                      # App Router — Next.js 15 RSC entry points
│   ├── [locale]/                             # next-intl: español sin prefijo · inglés en /en
│   │   │
│   │   ├── (auth)/                           # Route group: Authentication
│   │   │   ├── login/
│   │   │   │   ├── page.tsx                  # RSC·SSR|Guard|FSD|Async·React|Auth·READ
│   │   │   │   └── magic/
│   │   │   │       └── page.tsx              # RSC|Template|FSD|Async·React|Enlace mágico (RF-01.3)
│   │   │   ├── register/
│   │   │   │   └── page.tsx                  # RSC·SSR|Guard|FSD|Async·React|Auth·CREATE
│   │   │   ├── verify/
│   │   │   │   └── [token]/
│   │   │   │       └── page.tsx              # RSC·ISR|Guard|FSD|Async·React|Auth·UPDATE
│   │   │   ├── forgot-password/
│   │   │   │   └── page.tsx                  # RSC·SSR|Guard|FSD|Async·React|Auth·CREATE
│   │   │   └── layout.tsx                    # RSC|HOC|FSD|React|Auth layout
│   │   │
│   │   ├── (storefront)/                     # Route group: Public storefront
│   │   │   ├── page.tsx                      # RSC·SSR|Observer|FSD|Async·React|Home·READ
│   │   │   ├── products/
│   │   │   │   ├── page.tsx                  # RSC·SSR|Observer|FSD|Async·React|Product·List
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx              # RSC·SSR·ISR|Strategy|FSD|Async·React|Product·Detail
│   │   │   ├── categories/
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx              # RSC·SSG·ISR|Observer|FSD|Async·React|Category·List
│   │   │   ├── brands/
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx              # RSC·SSG·ISR|Observer|FSD|Async·React|Brand·List
│   │   │   ├── collections/
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx              # RSC·SSG·ISR|Observer|FSD|Async·React|Collection·List
│   │   │   ├── search/
│   │   │   │   ├── page.tsx                  # RSC·SSR|Strategy|FSD|Async·React|Search·READ
│   │   │   │   └── SearchView.tsx            # React·TS|Strategy|FSD|React|Search view
│   │   │   └── layout.tsx                    # RSC|HOC|FSD|React|Storefront layout
│   │   │
│   │   ├── (commerce)/                       # Route group: Commerce flow
│   │   │   ├── cart/
│   │   │   │   ├── page.tsx                  # RSC·SSR|Guard|FSD|Async·React|Cart·READ
│   │   │   │   └── CartView.tsx              # React·Redux Toolkit|Observer|FSD|React|Cart view
│   │   │   ├── checkout/
│   │   │   │   ├── page.tsx                  # RSC·SSR|Guard|FSD|Async·React|Checkout·CREATE
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── CheckoutStepView.tsx  # React·Redux Toolkit|Strategy|FSD|React|Step view
│   │   │   │   │   ├── address/
│   │   │   │   │   │   └── page.tsx          # RSC·SSR|Guard|FSD|Async·React|Address·UPDATE
│   │   │   │   │   ├── payment/
│   │   │   │   │   │   └── page.tsx          # RSC·SSR|Guard|FSD|Async·React|Payment·CREATE
│   │   │   │   │   └── confirm/
│   │   │   │   │       └── page.tsx          # RSC·SSR|Guard|FSD|Async·React|Order·UPDATE
│   │   │   │   └── success/
│   │   │   │       └── page.tsx              # RSC·SSR|Guard|FSD|Async·React|Order·READ
│   │   │   ├── layout.tsx                    # RSC|Guard·HOC|FSD|React|Commerce layout
│   │   │   └── loading.tsx                   # RSC|-|FSD|React|Suspense UI
│   │   │
│   │   ├── (account)/                        # Route group: User account
│   │   │   ├── account/
│   │   │   │   ├── page.tsx                  # RSC·SSR|Guard|FSD|Async·React|Profile·READ
│   │   │   │   ├── AccountOverview.tsx       # React·TS|Facade|FSD|React|Account summary
│   │   │   │   ├── AccountSection.tsx        # React·TS|Composite|FSD|React|Section card
│   │   │   │   ├── orders/
│   │   │   │   │   ├── page.tsx              # RSC·SSR|Guard|FSD|Async·React|Orders·List
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── page.tsx          # RSC·SSR|Guard|FSD|Async·React|Order·Detail
│   │   │   │   ├── wishlist/
│   │   │   │   │   ├── page.tsx              # RSC·SSR|Guard|FSD|Async·React|Wishlist·READ
│   │   │   │   │   └── WishlistView.tsx      # React·Redux Toolkit|Observer|FSD|React|Wishlist UI
│   │   │   │   ├── reviews/
│   │   │   │   │   └── page.tsx              # RSC·SSR|Guard|FSD|Async·React|Reviews·List
│   │   │   │   ├── addresses/
│   │   │   │   │   ├── page.tsx              # RSC·SSR|Guard|FSD|Async·React|Address·List
│   │   │   │   │   └── AddressBook.tsx       # React·Zod|Factory|FSD|React·Func|Address CRUD
│   │   │   │   ├── loyalty/
│   │   │   │   │   └── page.tsx              # RSC·SSR|Guard|FSD|Async·React|Points·READ
│   │   │   │   ├── notifications/
│   │   │   │   │   └── page.tsx              # RSC·SSR|Guard|FSD|Async·React|Notif·List
│   │   │   │   └── settings/
│   │   │   │       └── page.tsx              # RSC·SSR|Guard|FSD|Async·React|Settings·UPDATE
│   │   │   ├── layout.tsx                    # RSC|Guard·HOC|FSD|React|Account layout
│   │   │   ├── AccountNav.tsx                # React·next-intl|Composite|FSD|React|Account nav
│   │   │   └── loading.tsx                   # RSC|-|FSD|React|Suspense UI
│   │   │
│   │   ├── (admin)/                          # Route group: Admin dashboard
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx                  # RSC·SSR|Guard·RBAC|FSD|Async·React|Dashboard·READ
│   │   │   │   ├── analytics/
│   │   │   │   │   └── page.tsx              # RSC·SSR|Guard·RBAC|FSD|Async·React|Analytics·READ
│   │   │   │   ├── products/
│   │   │   │   │   ├── page.tsx              # RSC·SSR|Guard·RBAC|FSD|Async·React|Products·List
│   │   │   │   │   ├── new/
│   │   │   │   │   │   └── page.tsx          # RSC·SSR|Guard·RBAC|FSD|Async·React|Product·CREATE
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── edit/
│   │   │   │   │           └── page.tsx      # RSC·SSR|Guard·RBAC|FSD|Async·React|Product·UPDATE
│   │   │   │   ├── orders/
│   │   │   │   │   └── page.tsx              # RSC·SSR|Guard·RBAC|FSD|Async·React|Orders·List
│   │   │   │   ├── customers/
│   │   │   │   │   └── page.tsx              # RSC·SSR|Guard·RBAC|FSD|Async·React|CRM·List
│   │   │   │   ├── inventory/
│   │   │   │   │   └── page.tsx              # RSC·SSR|Guard·RBAC|FSD|Async·React|Inventory·READ
│   │   │   │   ├── media/
│   │   │   │   │   └── page.tsx              # RSC·SSR|Guard·RBAC|FSD|Async·React|Media·List
│   │   │   │   ├── ai-assistant/
│   │   │   │   │   └── page.tsx              # RSC·SSR|Guard·RBAC|FSD|Async·React|LLM·Admin
│   │   │   │   ├── marketing/
│   │   │   │   │   └── page.tsx              # RSC·SSR|Guard·RBAC|FSD|Async·React|Campaign·List
│   │   │   │   ├── settings/
│   │   │   │   │   └── page.tsx              # RSC·SSR|Guard·RBAC|FSD|Async·React|Config·UPDATE
│   │   │   │   └── AdminSection.tsx          # RSC|Factory·Template|FSD|React|adminPage + metadatos
│   │   │   └── layout.tsx                    # RSC|Guard·RBAC·HOC|FSD|React|Admin layout
│   │   │
│   │   ├── (ai)/                             # Route group: AI features
│   │   │   ├── chat/
│   │   │   │   └── page.tsx                  # RSC·SSR|Guard|FSD|Async·React|AI·Chat
│   │   │   └── recommendations/
│   │   │       └── page.tsx                  # RSC·SSR|Observer|FSD|Async·React|AI·Recs·READ
│   │   │
│   │   ├── (social)/                         # Route group: Social commerce
│   │   │   ├── social/
│   │   │   │   ├── page.tsx                  # RSC·SSR|Guard|FSD|Async·React|Social·READ
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx              # RSC·SSR·ISR|Observer|FSD|Async·React|Post·Detail
│   │   │   └── influencers/
│   │   │       └── page.tsx                  # RSC·SSR|Guard|FSD|Async·React|Influencer·List
│   │   │
│   │   ├── _components/
│   │   │   ├── JsonLd.tsx                    # RSC·TS|-|FSD|React|JSON-LD SEO
│   │   │   └── SiteChrome.tsx                # React·TS|Composite|FSD|React|Header/Footer
│   │   ├── layout.tsx                        # RSC·next-intl|HOC|FSD|React|Locale layout
│   │   ├── providers.tsx                     # Client·TS|Provider|FSD|React|Client providers
│   │   ├── not-found.tsx                     # RSC|-|FSD|React|404 page
│   │   └── error.tsx                         # Client|Observer|FSD|React|Error boundary
│   │
│   ├── api/                                  # API Routes (Route Handlers)
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts                  # next-auth·JWT|Strategy|FSD|Async|Auth handler
│   │   ├── webhooks/
│   │   │   ├── stripe/
│   │   │   │   └── route.ts                  # Stripe·TS|Handler|FSD|Async|Payment webhook
│   │   │   └── inventory/
│   │   │       └── route.ts                  # TS|Handler|FSD|Async|Stock webhook
│   │   └── revalidate/
│   │       └── route.ts                      # Next·TS|Handler|FSD|Async|ISR revalidate
│   │
│   ├── layout.tsx                            # RSC·TS|HOC|FSD|React|Root layout
│   ├── not-found.tsx                         # RSC|-|FSD|React|404 global
│   ├── globals.css                           # Tailwind·CSS|-|FSD|-|Tokens CSS
│   ├── sitemap.ts                            # Next·TS|-|FSD|Async|Sitemap ES/EN
│   └── robots.ts                             # Next·TS|-|FSD|Func|robots.txt
│
├── features/                                 # FSD Layer 3 — Business features
│   │
│   ├── auth/                                 # Feature: Authentication
│   │   ├── ui/
│   │   │   ├── LoginForm.tsx                 # React·Zod|Factory|FSD|React·Func|Login form
│   │   │   ├── RegisterForm.tsx              # React·Zod|Factory|FSD|React·Func|Register form
│   │   │   ├── OAuthButtons.tsx              # next-auth·TS|Adapter|FSD|React·Func|OAuth btns
│   │   │   ├── MagicLinkForm.tsx             # React·Formik·Zod|Facade|FSD|React·Func|Pedir enlace mágico (RF-01.3)
│   │   │   ├── GuestCheckoutForm.tsx         # React·Formik·Zod|Template|FSD|React·Func|Compra como invitado (RF-08.1)
│   │   │   ├── MagicLinkLogin.tsx            # React·TanStack Query|Template|FSD|React·Func|Canjear enlace mágico
│   │   │   ├── ForgotPasswordForm.tsx        # React·Zod|Factory|FSD|React·Func|Reset form
│   │   │   ├── VerifyEmailForm.tsx           # React·Zod|Observer|FSD|React·Func|OTP verify
│   │   │   └── UpdatePasswordForm.tsx        # React·Zod|Factory|FSD|React·Func|Change pwd
│   │   ├── model/
│   │   │   └── auth.store.ts                 # Redux Toolkit|Observer·Sing|FSD|Reactivo|Auth state
│   │   ├── api/
│   │   │   └── auth.api.ts                   # TanStack·Axios|Repository|FSD|Async|Auth HTTP
│   │   └── lib/
│   │       └── auth.validator.ts             # Zod·TS|Schema|FSD|Func|Schema auth
│   │
│   ├── product/                              # Feature: Products
│   │   ├── ui/
│   │   │   ├── ProductCard.tsx               # React·TS|Factory|FSD|React|Card UI
│   │   │   ├── ProductGrid.tsx               # React·TS|Composite|FSD|React|Grid layout
│   │   │   ├── ProductFilters.tsx            # React·Zod|Strategy|FSD|React·Func|Filter UI
│   │   │   ├── ProductGallery.tsx            # React·TS|Observer|FSD|React|Image gallery
│   │   │   ├── ProductVariants.tsx           # React·Zod|Strategy|FSD|React·Func|Variant select
│   │   │   ├── ProductReviews.tsx            # React·TS|Composite|FSD|React|Reviews list
│   │   │   └── AddToCartButton.tsx           # React·Redux Toolkit|Command|FSD|React·Func|Cart action
│   │   ├── model/
│   │   │   └── product.store.ts              # Redux Toolkit|Observer·Sing|FSD|Reactivo|Product state
│   │   ├── api/
│   │   │   └── product.api.ts                # TanStack·Axios|Repository|FSD|Async|Product HTTP
│   │   └── lib/
│   │       └── product.validator.ts          # Zod·TS|Schema|FSD|Func|Schema product
│   │
│   ├── cart/                                 # Feature: Shopping Cart
│   │   ├── ui/
│   │   │   ├── CartDrawer.tsx                # React·Redux Toolkit|Observer|FSD|React|Slide cart
│   │   │   ├── CartItem.tsx                  # React·TS|Factory|FSD|React|Item row
│   │   │   ├── CartSummary.tsx               # React·TS|Facade|FSD|React|Total summary
│   │   │   ├── CartEmpty.tsx                 # React·TS|-|FSD|React|Empty state
│   │   │   └── CartBadge.tsx                 # React·Redux Toolkit|Observer|FSD|React|Badge count
│   │   ├── model/
│   │   │   └── cart.store.ts                 # Redux Toolkit|Observer·Sing|FSD|Reactivo|Cart state
│   │   ├── api/
│   │   │   └── cart.api.ts                   # TanStack·Axios|Repository|FSD|Async|Cart HTTP
│   │   └── lib/
│   │       └── cart.validator.ts             # Zod·TS|Schema|FSD|Func|Schema cart
│   │
│   ├── checkout/                             # Feature: Checkout Flow
│   │   ├── ui/
│   │   │   ├── CheckoutStepper.tsx           # React·TS|Strategy|FSD|React|Step wizard
│   │   │   ├── AddressForm.tsx               # React·Zod|Factory|FSD|React·Func|Address form
│   │   │   ├── PaymentForm.tsx               # Stripe·React|Adapter|FSD|React·Func|Stripe elements
│   │   │   ├── OrderSummary.tsx              # React·TS|Facade|FSD|React|Order preview
│   │   │   └── ConfirmButton.tsx             # React·Redux Toolkit|Command|FSD|React·Func|Place order
│   │   ├── model/
│   │   │   └── checkout.store.ts             # Redux Toolkit|Observer·Sing|FSD|Reactivo|Checkout state
│   │   ├── api/
│   │   │   └── checkout.api.ts               # TanStack·Axios|Repository|FSD|Async|Checkout HTTP
│   │   └── lib/
│   │       └── checkout.validator.ts         # Zod·TS|Schema|FSD|Func|Schema checkout
│   │
│   ├── order/                                # Feature: Orders
│   │   ├── ui/
│   │   │   ├── OrderList.tsx                 # React·TS|Composite|FSD|React|Order list
│   │   │   ├── OrderCard.tsx                 # React·TS|Factory|FSD|React|Order card
│   │   │   ├── OrderDetail.tsx               # React·TS|Facade|FSD|React|Order detail
│   │   │   ├── OrderStatus.tsx               # React·TS|Strategy|FSD|React|Status badge
│   │   │   └── OrderTracking.tsx             # React·TS|Observer|FSD|React|Track map
│   │   ├── model/
│   │   │   └── order.store.ts                # Redux Toolkit|Observer·Sing|FSD|Reactivo|Order state
│   │   ├── api/
│   │   │   └── order.api.ts                  # TanStack·Axios|Repository|FSD|Async|Order HTTP
│   │   └── lib/
│   │       └── order.validator.ts            # Zod·TS|Schema|FSD|Func|Schema order
│   │
│   ├── payment/                              # Feature: Payments
│   │   ├── ui/
│   │   │   ├── StripePayment.tsx             # Stripe·React|Adapter|FSD|React|Stripe form
│   │   │   ├── PaymentMethods.tsx            # React·TanStack Query|Strategy·Facade|FSD|React|Tarjeta, transferencia, contra entrega, cripto (RF-08.3)
│   │   │   ├── SavedPaymentMethods.tsx       # Stripe Elements·TanStack Query|Facade·Composite|FSD|React|Métodos guardados (RF-02.3)
│   │   │   ├── PaymentStatus.tsx             # React·TS|Strategy|FSD|React|Status UI
│   │   │   └── PaymentHistory.tsx            # React·TS|Composite|FSD|React|History list
│   │   ├── model/
│   │   │   └── payment.store.ts              # Redux Toolkit|Observer·Sing|FSD|Reactivo|Payment state
│   │   ├── api/
│   │   │   └── payment.api.ts                # TanStack·Axios|Repository|FSD|Async|Payment HTTP
│   │   └── lib/
│   │       └── payment.validator.ts          # Zod·TS|Schema|FSD|Func|Schema payment
│   │
│   ├── search/                               # Feature: Advanced Search
│   │   ├── ui/
│   │   │   ├── SearchBar.tsx                 # React·Zod|Observer|FSD|React·Func|Search input
│   │   │   ├── SearchResults.tsx             # React·TS|Composite|FSD|React|Results list
│   │   │   ├── SearchFilters.tsx             # React·Zod|Strategy|FSD|React·Func|Facets filter
│   │   │   ├── SearchSuggestions.tsx         # React·TS|Observer|FSD|React|Autocomplete
│   │   │   └── ImageSearch.tsx               # React·TS|Adapter|FSD|React·Func|Visual search
│   │   ├── model/
│   │   │   └── search.store.ts               # Redux Toolkit|Observer·Sing|FSD|Reactivo|Search state
│   │   ├── api/
│   │   │   └── search.api.ts                 # TanStack·Axios|Repository|FSD|Async|Search HTTP
│   │   └── lib/
│   │       └── search.validator.ts           # Zod·TS|Schema|FSD|Func|Schema search
│   │
│   ├── review/                               # Feature: Reviews & Ratings
│   │   ├── ui/
│   │   │   ├── ReviewForm.tsx                # React·Zod|Factory|FSD|React·Func|Write review
│   │   │   ├── ReviewList.tsx                # React·TS|Composite|FSD|React|Reviews list
│   │   │   ├── StarRating.tsx                # React·TS|-|FSD|React|Rating widget
│   │   │   └── ReviewSummary.tsx             # React·TS|Facade|FSD|React|Avg rating
│   │   ├── model/
│   │   │   └── review.store.ts               # Redux Toolkit|Observer·Sing|FSD|Reactivo|Review state
│   │   ├── api/
│   │   │   └── review.api.ts                 # TanStack·Axios|Repository|FSD|Async|Review HTTP
│   │   └── lib/
│   │       └── review.validator.ts           # Zod·TS|Schema|FSD|Func|Schema review
│   │
│   ├── loyalty/                              # Feature: Loyalty Program
│   │   ├── ui/
│   │   │   ├── PointsBalance.tsx             # React·TS|Observer|FSD|React|Points UI
│   │   │   ├── NFTBadgeGallery.tsx           # React·ethers|Adapter|FSD|React|NFT gallery
│   │   │   ├── LoyaltyExtras.tsx             # React·TanStack Query|Composite·Facade|FSD|React|Beneficios, logros, ranking, referidos (RF-14)
│   │   │   ├── RewardsHistory.tsx            # React·TS|Composite|FSD|React|History list
│   │   │   └── LoyaltyTiers.tsx              # React·TS|Strategy|FSD|React|Tier display
│   │   ├── model/
│   │   │   └── loyalty.store.ts              # Redux Toolkit|Observer·Sing|FSD|Reactivo|Points state
│   │   ├── api/
│   │   │   └── loyalty.api.ts                # TanStack·Axios|Repository|FSD|Async|Loyalty HTTP
│   │   └── lib/
│   │       └── loyalty.validator.ts          # Zod·TS|Schema|FSD|Func|Schema loyalty
│   │
│   ├── notification/                         # Feature: Notifications
│   │   ├── ui/
│   │   │   ├── NotificationBell.tsx          # React·Redux Toolkit|Observer|FSD|React|Bell icon
│   │   │   ├── NotificationList.tsx          # React·TS|Composite|FSD|React|Notif list
│   │   │   └── NotificationToast.tsx         # React·TS|Observer|FSD|React|Toast popup
│   │   ├── model/
│   │   │   └── notification.store.ts         # Redux Toolkit·WS|Observer·Sing|FSD|Reactivo|Notif state
│   │   ├── api/
│   │   │   └── notification.api.ts           # TanStack·WS|Repository|FSD|Async|Notif HTTP+WS
│   │   └── lib/
│   │       └── notification.validator.ts     # Zod·TS|Schema|FSD|Func|Schema notif
│   │
│   ├── ai-chat/                              # Feature: AI Chat (consume LLM Assistant de FastAPI)
│   │   ├── ui/
│   │   │   ├── ChatWindow.tsx                # React·TS|Observer|FSD|React|Chat UI
│   │   │   ├── ChatMessage.tsx               # React·TS|Factory|FSD|React|Message bubble
│   │   │   ├── ChatInput.tsx                 # React·Zod|Observer|FSD|React·Func|Input box
│   │   │   └── AITypingIndicator.tsx         # React·TS|Observer|FSD|React|Typing anim
│   │   ├── model/
│   │   │   └── chat.store.ts                 # Redux Toolkit|Observer·Sing|FSD|Reactivo|Chat state
│   │   ├── api/
│   │   │   ├── chat.api.ts                   # REST·SSE|Repository|FSD|Async|LLM chat HTTP+SSE
│   │   │   └── llm-admin.api.ts              # REST·TS|Repository|FSD|Async|LLM admin HTTP
│   │   └── lib/
│   │       └── chat.validator.ts             # Zod·TS|Schema|FSD|Func|Schema chat
│   │
│   ├── social-commerce/                      # Feature: Social Commerce
│   │   ├── ui/
│   │   │   ├── SocialFeed.tsx                # React·TS|Observer|FSD|React|Social feed
│   │   │   ├── SocialPost.tsx                # React·TS|Factory|FSD|React|Post card
│   │   │   ├── InfluencerProfile.tsx         # React·TS|Facade|FSD|React|Profile page
│   │   │   └── SocialShare.tsx               # React·TS|Adapter|FSD|React·Func|Share widget
│   │   ├── model/
│   │   │   └── social.store.ts               # Redux Toolkit|Observer·Sing|FSD|Reactivo|Social state
│   │   ├── api/
│   │   │   └── social.api.ts                 # TanStack·Axios|Repository|FSD|Async|Social HTTP
│   │   └── lib/
│   │       └── social.validator.ts           # Zod·TS|Schema|FSD|Func|Schema social
│   │
│   ├── admin-dashboard/                      # Feature: Admin Dashboard
│   │   ├── ui/
│   │   │   ├── KPICard.tsx                   # React·Recharts|Factory|FSD|React|KPI widget
│   │   │   ├── SalesChart.tsx                # Recharts·TS|Observer|FSD|React·Data|Sales chart
│   │   │   ├── DataTable.tsx                 # React·TS|Composite|FSD|React|Data grid
│   │   │   ├── AdminSidebar.tsx              # React·TS|Composite|FSD|React|Nav sidebar
│   │   │   ├── AdminFields.tsx               # React·TS|Template|FSD|React|Select/textarea/search
│   │   │   ├── AdminTabs.tsx                 # React·Redux Toolkit|Composite|FSD|React|WAI-ARIA tabs
│   │   │   ├── AdminResource.tsx             # React·Formik·Zod|Template·Strategy·Command|FSD|React|CRUD genérico
│   │   │   ├── DashboardOverview.tsx         # React·Socket.io|Facade·Strategy·Observer|FSD|React|KPIs + widgets
│   │   │   ├── VendorOverview.tsx            # React·TanStack Query|Strategy·Facade|FSD|React|Portada del VENDEDOR (PanelOverview por rol)
│   │   │   ├── AnalyticsPanel.tsx            # React·Recharts|CQRS read|FSD|React|Embudo, reportes, grafo IA
│   │   │   ├── AnalyticsAdvanced.tsx         # React·Canvas|Composite·Strategy|FSD|React|RF-24.6/24.8/24.10/24.11/24.12/24.14
│   │   │   ├── ProductsAdmin.tsx             # React·Formik·Zod|Adapter·Composite|FSD|React|Products·CRUD
│   │   │   ├── CatalogTools.tsx              # React·TanStack Query·Formik|Composite·Command|FSD|React|Excel/CSV, lote, marcas (RF-04.3/05)
│   │   │   ├── OrdersAdmin.tsx               # React·TS|Composite·Strategy|FSD|React|Pedidos/envíos/facturas/devoluciones
│   │   │   ├── CustomersAdmin.tsx            # React·TS|Facade|FSD|React|CRM 360°
│   │   │   ├── CrmInsights.tsx               # React·TanStack Query|Composite·Command|FSD|React|RF-22.2/22.4/22.6/22.7/22.8/22.9/22.10
│   │   │   ├── InventoryAdmin.tsx            # React·TS|Command·Observer|FSD|React|Stock + proveedores
│   │   │   ├── ProcurementAdmin.tsx          # React·BarcodeDetector|Composite·Command|FSD|React|RF-23.3/23.5/23.6/23.7/23.8/23.9
│   │   │   ├── MarketingAdmin.tsx            # React·TS|Composite·Command|FSD|React|Campañas/correo/plantillas/cupones
│   │   │   ├── EmailDesigner.tsx             # React·HTML5 DnD|Composite·Command|FSD|React|RF-21.6 diseñador visual de correos
│   │   │   ├── SettingsAdmin.tsx             # React·TS|Guard·Command|FSD|React|RBAC/webhooks/n8n/auditoría/MCP
│   │   │   ├── AuditCenter.tsx               # React·Socket.io|Observer·Command|FSD|React|RF-30.2/30.3/30.4/30.6/30.7/30.8
│   │   │   └── AiAssistantAdmin.tsx          # React·TS|Command|FSD|React|LLM: RAG/herramientas/evaluaciones
│   │   │   ├── SupportAdmin.tsx              # React·TanStack Query|Composite·Command|FSD|React|RF-17.11/17.12/17.13 soporte y NLU
│   │   │   ├── GrowthAdmin.tsx               # React·SVG|Composite·Strategy|FSD|React|RF-18.8 churn · RF-18.9 grafo · RF-18.10 rebajas
│   │   │   ├── AutomationHealth.tsx          # React·TanStack Query|Observer·Command|FSD|React|RF-20.2 plantillas · RF-20.7 salud
│   │   ├── model/
│   │   │   └── dashboard.store.ts            # Redux Toolkit|Observer·Sing|FSD|Reactivo|Dash state
│   │   ├── api/
│   │   │   └── dashboard.api.ts              # TanStack·Axios|Repository|FSD|Async|Admin HTTP
│   │   └── lib/
│   │       └── dashboard.validator.ts        # Zod·TS|Schema|FSD|Func|Schema dash
│   │
│   ├── media/                                # Feature: Media Manager
│   │   ├── ui/
│   │   │   ├── MediaUploader.tsx             # React·Cloud|Strategy|FSD|React·Func|Upload zone
│   │   │   ├── MediaGrid.tsx                 # React·TS|Composite|FSD|React|Asset grid
│   │   │   └── MediaPreview.tsx              # React·TS|Factory|FSD|React|Preview modal
│   │   ├── model/
│   │   │   └── media.store.ts                # Redux Toolkit|Observer·Sing|FSD|Reactivo|Media state
│   │   ├── api/
│   │   │   └── media.api.ts                  # TanStack·Axios|Repository|FSD|Async|Media HTTP
│   │   └── lib/
│   │       └── media.validator.ts            # Zod·TS|Schema|FSD|Func|Schema media
│   │
│   └── settings/                             # Feature: User/Admin Settings
│       ├── ui/
│       │   ├── ProfileSettings.tsx           # React·Zod|Factory|FSD|React·Func|Profile form
│       │   ├── SecuritySettings.tsx          # React·Zod|Factory|FSD|React·Func|Security form
│       │   ├── PhoneVerification.tsx         # React·TanStack Query|State·Facade|FSD|React·Func|Celular por SMS (RF-01.1)
│       │   ├── NotifSettings.tsx             # React·Zod|Factory|FSD|React·Func|Notif prefs
│       │   ├── ThemeSettings.tsx             # React·TS|Strategy|FSD|React|Theme select
│       │   └── LanguageSwitcher.tsx          # next-intl·TS|Strategy|FSD|React·Func|ES/EN switch
│       ├── model/
│       │   └── settings.store.ts             # Redux Toolkit|Observer·Sing|FSD|Reactivo|Settings state
│       ├── api/
│       │   └── settings.api.ts               # TanStack·Axios|Repository|FSD|Async|Settings HTTP
│       └── lib/
│           └── settings.validator.ts         # Zod·TS|Schema|FSD|Func|Schema settings
│
├── widgets/                                  # FSD Layer 4 — Composed UI blocks
│   ├── auth/
│   │   ├── AuthBanner.tsx                    # React·TS|Composite|FSD|React|Auth hero
│   │   └── UserMenu.tsx                      # React·Redux Toolkit|Observer|FSD|React|User dropdown
│   ├── product/
│   │   ├── FeaturedProducts.tsx              # RSC·TS|Observer|FSD|Async·React|Featured grid
│   │   ├── ProductCarousel.tsx               # React·Framer|Composite|FSD|React|Slide carousel
│   │   └── RecommendedProducts.tsx           # RSC·TanStack|Observer|FSD|Async·React|AI recs grid
│   ├── cart/
│   │   └── MiniCart.tsx                      # React·Redux Toolkit|Observer|FSD|React|Hover cart
│   ├── navigation/
│   │   ├── Header.tsx                        # React·TS|Composite|FSD|React|Site header
│   │   ├── Footer.tsx                        # React·TS|Composite|FSD|React|Site footer
│   │   ├── MegaMenu.tsx                      # React·TS|Composite|FSD|React|Nav megamenu
│   │   └── MobileNav.tsx                     # React·TS|Composite|FSD|React|Mobile drawer
│   ├── loyalty/
│   │   └── PointsBanner.tsx                  # React·Redux Toolkit|Observer|FSD|React|Points banner
│   └── analytics/
│       └── AnalyticsTracker.tsx              # React·GTM|Observer|FSD|React|Track events
│
├── entities/                                 # FSD Layer 5 — Business entities (pure)
│   ├── product/
│   │   ├── ui/
│   │   │   └── ProductImage.tsx              # next/image·TS|-|FSD|React|Optimized img
│   │   └── model/
│   │       └── product.types.ts              # TS strict|VO|FSD|Typed|Product types
│   ├── user/
│   │   ├── api/
│   │   │   └── user.api.ts                   # Axios·TS|Repository|FSD|Async|User HTTP
│   │   ├── ui/
│   │   │   └── Avatar.tsx                    # React·TS|-|FSD|React|User avatar
│   │   └── model/
│   │       └── user.types.ts                 # TS strict|VO|FSD|Typed|User types
│   ├── order/
│   │   └── model/
│   │       └── order.types.ts                # TS strict|VO|FSD|Typed|Order types
│   └── cart/
│       ├── api/
│       │   └── cart.api.ts                   # Axios·TS|Repository|FSD|Async|Cart HTTP
│       └── model/
│           └── cart.types.ts                 # TS strict|VO|FSD|Typed|Cart types
│
├── shared/                                   # FSD Layer 6 — Infrastructure shared
│   ├── ui/                                   # Design System components
│   │   ├── Button.tsx                        # shadcn·Radix|Factory|FSD|React|Base button
│   │   ├── Input.tsx                         # shadcn·Radix|Factory|FSD|React|Base input
│   │   ├── Modal.tsx                         # shadcn·Radix|-|FSD|React|Dialog modal
│   │   ├── Toast.tsx                         # shadcn·Radix|Observer|FSD|React|Toast notify
│   │   ├── Skeleton.tsx                      # shadcn·TS|-|FSD|React|Loading bone
│   │   ├── Badge.tsx                         # shadcn·TS|Factory|FSD|React|Status badge
│   │   ├── Pagination.tsx                    # React·TS|-|FSD|React|Page control
│   │   ├── EmptyState.tsx                    # React·TS|-|FSD|React|Empty UI
│   │   └── ErrorBoundary.tsx                 # React·TS|Observer|FSD|React|Error catch
│   ├── hook/
│   │   ├── useAuth.ts                        # next-auth·JWT|Facade|FSD|Reactivo|Auth hook
│   │   ├── useCart.ts                        # Redux Toolkit|Observer|FSD|Reactivo|Cart drawer
│   │   ├── useMediaQuery.ts                  # React·TS|Observer|FSD|Reactivo|Responsive hook
│   │   ├── useDebounce.ts                    # React·TS|-|FSD|Func|Debounce util
│   │   ├── useIntersection.ts                # React·TS|Observer|FSD|Reactivo|Lazy load hook
│   │   ├── useWebSocket.ts                   # graphql-ws·Apollo|Observer|FSD|Reactivo|WS hook
│   │   ├── useErrorMessage.ts                # next-intl·TS|-|FSD|Func|Error i18n
│   │   ├── useFormat.ts                      # Intl·TS|-|FSD|Func|Format hook
│   │   └── useZodForm.ts                     # Formik·Zod|Factory|FSD|Func|Form hook
│   ├── lib/
│   │   ├── api-client.ts                     # Axios·TS|Singleton|FSD|Async|HTTP client
│   │   ├── device-id.ts                      # WebCrypto·TS|Singleton|FSD|Async|Huella del dispositivo (RF-08.11)
│   │   ├── query-client.ts                   # TanStack·TS|Singleton|FSD|Async|Query client
│   │   ├── store.ts                          # Redux Toolkit|Facade|FSD|Reactivo|Client State infra
│   │   ├── auth-config.ts                    # next-auth·TS|Singleton|FSD|POO|Auth config
│   │   ├── cn.ts                             # clsx·twmerge|Util|FSD|Func|ClassNames util
│   │   ├── format.ts                         # Intl·TS|Util|FSD|Func|Format dates/$$
│   │   ├── analytics.ts                      # GTM·TS|Observer|FSD|Func|Track events
│   │   ├── wallet.ts                         # EIP-1193·TS|Adapter|FSD|Async|SIWE wallet
│   │   └── i18n/
│   │       ├── routing.ts                    # next-intl·TS|Config|FSD|Typed|Locales
│   │       ├── navigation.ts                 # next-intl·TS|Adapter|FSD|Func|Link/redirect
│   │       ├── request.ts                    # next-intl·TS|Config|FSD|Async|Request config
│   │       └── server.ts                     # next-intl·TS|Facade|FSD|Async|Server helpers
│   ├── types/
│   │   ├── api.types.ts                      # TS strict|VO|FSD|Typed|API response
│   │   ├── common.types.ts                   # TS strict|VO|FSD|Typed|Shared types
│   │   └── next.types.ts                     # TS strict|VO|FSD|Typed|Next.js types
│   └── constants/
│       ├── routes.ts                         # TS|Config|FSD|Typed|Route paths
│       └── config.ts                         # TS|Config|FSD|Typed|App constants
│
├── public/                                   # Static assets
│   ├── icons/                                # SVG icons (WCAG accessible)
│   ├── images/                               # Static images (og, logo)
│   └── fonts/                                # Local fonts (next/font)
│
├── messages/                                 # i18n translations
│   ├── es.json                               # next-intl|i18n|FSD|-|Spanish
│   └── en.json                               # next-intl|i18n|FSD|-|English
│
├── .env.local                                # -|Config|-|-|Env variables
├── .env.example                              # -|Config|-|-|Env template
├── next.config.ts                            # Next·TS|Config|-|-|Next.js config
├── tailwind.config.ts                        # Tailwind·TS|Config|-|-|CSS config
├── tsconfig.json                             # TS strict|Config|-|-|TS strict config
├── postcss.config.js                         # PostCSS|Config|-|-|Tailwind build
├── eslint.config.mjs                         # ESLint 9|Config|-|-|Flat config
├── components.json                           # shadcn/ui|Config|-|-|shadcn config
├── next-env.d.ts                             # Next·TS|-|-|Typed|Next types
├── Dockerfile                                # Docker|Config|-|-|Imagen standalone
├── scripts/
│   └── check-messages.mjs                    # Node·ESM|-|-|Func|pnpm i18n:check
├── middleware.ts                             # next-auth·TS|Guard|FSD|Async|Route protect
└── package.json                              # pnpm·TS|Config|-|-|Dependencies
```

---

## ABREVIATURAS

| Abr.        | Significado                               |
|-------------|-------------------------------------------|
| FSD         | Feature-Sliced Design                     |
| RSC         | React Server Component                    |
| SSR         | Server-Side Rendering                     |
| SSG         | Static Site Generation                    |
| ISR         | Incremental Static Regeneration           |
| HOC         | Higher Order Component                    |
| Guard       | Route/auth guard middleware               |
| RBAC        | Role-Based Access Control                 |
| Observer    | Observer / Reactive Pattern               |
| Factory     | Factory Pattern                           |
| Composite   | Composite / Container Pattern             |
| Adapter     | Adapter Pattern                           |
| Strategy    | Strategy Pattern                          |
| Sing        | Singleton Pattern                         |
| Command     | Command Pattern                           |
| Facade      | Facade Pattern                            |
| VO          | Value Object                              |
| Reactivo    | Reactive Programming (Redux Toolkit + TanStack Query) |
| Func        | Functional Programming                    |
| Typed       | Strongly Typed (TypeScript strict)        |
| Data        | Data-Driven                               |
| WS          | WebSocket                                 |
| GTM         | Google Tag Manager                        |
| Cloud       | Cloudinary                                |
| i18n        | Internationalization                      |
| a11y        | Accessibility (WCAG 2.1 AA)               |
| WCAG        | Web Content Accessibility Guidelines      |

---

## 🧭 GESTIÓN DE ESTADO — TanStack Query + Redux Toolkit (03/10/2026)

Decisión vigente para Next.js: **Formik + Zod** (formularios), **Axios** (cliente HTTP), **TanStack Query** (Server State) y **Redux Toolkit** (Client State). Zustand y React Hook Form no se usan.

Usa TanStack Query y Redux Toolkit de forma complementaria siguiendo estas reglas:

1. TanStack Query: úsalo para todo estado proveniente del backend/API: queries, mutations, cache, refetch, paginación, invalidación y sincronización de datos.
2. Redux Toolkit: úsalo únicamente para estado global del cliente/UI que no sea simplemente una copia de datos del backend.
3. No dupliques datos del servidor entre TanStack Query y Redux.
4. No guardes en Redux datos que ya están gestionados por TanStack Query.
5. No uses createAsyncThunk para hacer fetching de datos que pueda manejar TanStack Query.
6. Usa useQuery para lecturas y useMutation para modificaciones.
7. Después de mutations, invalida o actualiza únicamente las queries relacionadas.
8. Usa useState para estado local que no necesite Redux.
9. Mantén los componentes y la arquitectura actual del proyecto.
10. Antes de implementar algo, determina si el estado es Server State o Client State y elige la herramienta correspondiente.
11. No agregues nuevas librerías ni cambies decisiones arquitectónicas existentes sin consultarme primero.
12. Prioriza código simple, tipado, mantenible y consistente con el proyecto existente.

Cómo se aplica en el código:

| Pieza | Archivo | Qué hace |
|---|---|---|
| Cliente de consultas | `shared/lib/query-client.ts` | QueryClient (staleTime 60 s, sin reintentos en 4xx) y claves de caché centralizadas (`queryKeys`) |
| Hooks de Server State | `entities/*/api/*.api.ts` · `features/*/api/*.api.ts` | `useQuery` para lecturas y `useMutation` para escrituras; cada mutación invalida solo sus queries |
| Infraestructura Redux | `shared/lib/store.ts` | `createSliceHook` (estado + acciones de un slice), persistencia en local/sessionStorage y acceso al store para `toast.success()` |
| Store raíz | `app/[locale]/providers.tsx` | `combineSlices` de los slices de cada feature + `ReduxProvider`, `QueryClientProvider`, `ApolloProvider` y `SessionProvider` |
| Slices de Client State | `features/*/model/*.store.ts` · `shared/hook/useCart.ts` · `shared/ui/Toast.tsx` | Paso del login, cupón aplicado, borrador del checkout, filtros, selección, preferencias, avisos |
| Formularios | `shared/hook/useZodForm.ts` | Formik + esquemas Zod (estado local del formulario; el envío usa `useMutation`) |

Listado completo de hooks: `ESPECIFICACION_TECNICA_UNIFICADA.md`, sección **🪝 HOOKS DEL PROYECTO**.

---
**RF 01–05 y panel del vendedor (10/10/2026):** login con Google, Facebook y Apple (`auth-config.ts`; Apple envía su id_token) y enlace mágico (`MagicLinkForm` + `/login/magic`); Configuraciones: verificación del celular (`PhoneVerification`), métodos de pago guardados con Stripe SetupIntent (`SavedPaymentMethods`) y descarga de datos personales (GDPR). Panel: pestañas Productos | Marcas, insignias, filtros, exportar/importar Excel-CSV, duplicar, selección múltiple con edición en lote (`AdminResource.bulk`) y marcas con historia, país, premium/exclusiva y ventas (`CatalogTools.tsx`); roles con rol padre. El VENDOR entra al panel (`PANEL_ROLES`/`VENDOR_PANEL_ROUTES` en `shared/constants/routes.ts`): ve Productos, Pedidos (pedidos y envíos) y Medios; `panelHome()` decide el inicio por rol. Menú lateral más compacto (Next y Nuxt).

## ESTADO DE IMPLEMENTACIÓN — v35 (Fases 0–4)

> Política del proyecto: **solo tecnologías open source o gratuitas**. Detalle completo, con justificación por librería, en `docs/setup/04_NEXTJS15_SETUP.md` (sección 5).

| Tema | v34 | v35 (implementado) |
|------|-----|--------------------|
| Cliente HTTP | Axios | ✅ Axios en `shared/lib/api-client.ts` con `adapter: "fetch"`: conserva la cache ISR de Next (`fetchOptions.next: { revalidate, tags }`) |
| Server State | TanStack Query | ✅ TanStack Query v5: `useQuery` (lecturas) y `useMutation` (escrituras) en `*/api/*.api.ts` |
| Client State | Redux Toolkit | ✅ Redux Toolkit (03/10/2026; reemplaza a Zustand): slices en `*/model/*.store.ts`, store en `providers.tsx` |
| Formularios | Formik · Zod | ✅ Formik + Zod en `shared/hook/useZodForm.ts` (React Hook Form no se usa) |
| Fechas y moneda | Intl · dayjs | `Intl` nativo (formateadores cacheados) |
| Web3 en el login | wagmi | Estándar EIP-1193 (`window.ethereum`) en `shared/lib/wallet.ts`; wagmi + viem al llegar los pagos cripto |
| Pagos | Stripe Elements · PayPal | Solo Stripe Elements (PSP exclusivo según la matriz) |
| Imágenes | next-cloudinary | `next/image` + URLs optimizadas por el backend |
| UI base | shadcn · Radix | ✅ shadcn/ui + Radix (Material UI descartado: Emotion obliga a componentes de cliente y duplica Tailwind) |
| i18n | next-intl | ✅ `app/[locale]/`, español sin prefijo e inglés en `/en`, hreflang, 627 mensajes por idioma, `pnpm i18n:check` en CI |
| GraphQL cliente | Apollo Client | ✅ Apollo Client para reseñas (Mutation) y notificaciones en vivo (Subscription por graphql-ws); el resto, REST + TanStack Query |

> Estructura v35: los route groups del árbol (`(storefront)`, `(auth)`, `(commerce)`, `(account)`...) viven dentro de `app/[locale]/`; `app/api`, `sitemap.ts` y `robots.ts` quedan en la raíz de `app/`.

Módulos implementados: 1 Authentication (incluye login y vinculación de wallet), 3 Storefront, 4 Product Details, 5 Advanced Search, 6 Cart, 7 Checkout, 8 Orders, 9 Payments, 10 User Account, 11 Reviews, 12 Notifications, 13 Loyalty, 21 Coupons (en carrito), 22 Shipping (en checkout y seguimiento), 23 Invoice (descarga PDF) y 24 Refunds (solicitud desde el pedido), 30 Settings y 31 Shared. Los módulos de administración, IA y social (14–20, 25–29) corresponden a fases 6–7.

**Fase 7.3 (Admin Dashboard, 05/10/2026):** las 12 rutas de `app/[locale]/(admin)/dashboard` están implementadas con RBAC en dos capas (middleware + layout). Cada página es un Server Component creado por `adminPage()` (AdminSection.tsx) que monta su sección cliente. `AdminResource.tsx` es el CRUD genérico (listado paginado, filtros, búsqueda con debounce, diálogo crear/editar con Formik + Zod, borrado con confirmación) que comparten productos, pedidos, envíos, facturas, devoluciones, CRM, inventario, proveedores, campañas, correos, plantillas, cupones, roles, permisos, webhooks, flujos n8n, auditoría, MCP y el LLM Assistant (FastAPI). `features/media` = Media Manager de Cloudinary (subida validada en el navegador, carpetas, texto alternativo, reemplazo y borrado en lote). `widgets/analytics/AnalyticsTracker.tsx` envía `page_view` y los eventos de e-commerce a `POST /analytic/event` en lotes de hasta 50 (cada 30 s o al ocultar la pestaña; respeta DNT/GPC). Recharts solo se descarga en el panel (`next/dynamic`).

SEO técnico agregado: `app/sitemap.ts` (sitemap dinámico), `app/robots.ts` (bloquea todo fuera de producción), `app/api/revalidate/route.ts` (ISR bajo demanda llamado por Express al modificar el catálogo), JSON-LD `WebSite`, `Product` y `BreadcrumbList`, URLs canónicas y `noindex` en carrito, checkout, cuenta y búsqueda.

