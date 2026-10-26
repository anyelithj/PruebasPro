# ⚙️ BACKEND — Express TypeScript
## eCommerce Web3 Enterprise · N-Layer Architecture · 38 Módulos
## REST + GraphQL + WebSocket · Prisma ORM · PostgreSQL · MongoDB · JWT · Zod · MCP · SOLID/DRY

---

```
ecommerce-express/
├── src/
│   ├── module/                                          # N-Layer domain modules
│   │   │
│   │   ├── ── IDENTITY DOMAIN ────────────────────────────
│   │   │
│   │   ├── auth/                                        # Autenticación y Seguridad
│   │   │   ├── controller/
│   │   │   │   └── auth.controller.ts                   # JWT·Passport|Guard·Strat|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/
│   │   │   │   └── auth.service.ts                      # bcrypt·JWT|Strategy|N-Lyr|Async·POO|Auth logic
│   │   │   ├── repository/
│   │   │   │   └── auth.repository.ts                   # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/
│   │   │   │   └── auth.model.ts                        # Prisma·TS|ActiveRecord|N-Lyr|POO|Domain entity
│   │   │   ├── dto/
│   │   │   │   └── auth.dto.ts                          # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/
│   │   │   │   └── auth.route.ts                        # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/
│   │   │   │   └── auth.schema.ts                       # Zod|Schema|N-Lyr|Func|Validation
│   │   │   ├── types/
│   │   │   │   └── auth.types.ts                        # TS strict|VO|N-Lyr|Typed|Type defs
│   │   │   ├── util/
│   │   │   │   └── token.util.ts                        # JWT·crypto|Util|N-Lyr|Func|Sign/verify
│   │   │   ├── guard/
│   │   │   │   └── auth.guard.ts                        # JWT·Passport|Guard|N-Lyr|Async·POO|Token verify
│   │   │   ├── strategy/
│   │   │   │   ├── jwt.strategy.ts                      # Passport·JWT|Strategy|N-Lyr|Async·POO|JWT stateless
│   │   │   │   └── oauth.strategy.ts                    # OAuth2·axios|Strategy|N-Lyr|Async·POO|OAuth flow
│   │   │   └── exception/
│   │   │       └── auth.exception.ts                    # TS|Exception|N-Lyr|POO|Auth errors
│   │   │
│   │   ├── user/                                        # Gestión de Usuarios
│   │   │   ├── controller/user.controller.ts            # REST·GraphQL|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/user.service.ts                  # bcrypt·TS|Strategy|N-Lyr|Async·POO|User logic
│   │   │   ├── repository/user.repository.ts            # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/user.model.ts                      # Prisma·TS|ActiveRecord|N-Lyr|POO|User entity
│   │   │   ├── dto/user.dto.ts                          # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/user.route.ts                      # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/user.schema.ts                    # Zod|Schema|N-Lyr|Func|Validation
│   │   │   ├── types/user.types.ts                      # TS strict|VO|N-Lyr|Typed|Type defs
│   │   │   ├── guard/user.guard.ts                      # JWT·TS|Guard|N-Lyr|Async·POO|Owner check
│   │   │   ├── validator/user.validator.ts              # Zod·TS|Validator|N-Lyr|Func|Input rules
│   │   │   └── exception/user.exception.ts              # TS|Exception|N-Lyr|POO|User errors
│   │   │
│   │   ├── role/                                        # Roles y Control de Acceso
│   │   │   ├── controller/role.controller.ts            # REST·RBAC|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/role.service.ts                  # RBAC·TS|Strategy|N-Lyr|Async·POO|Role logic
│   │   │   ├── repository/role.repository.ts            # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/role.model.ts                      # Prisma·TS|ActiveRecord|N-Lyr|POO|Role entity
│   │   │   ├── dto/role.dto.ts                          # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/role.route.ts                      # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/role.schema.ts                    # Zod|Schema|N-Lyr|Func|Validation
│   │   │   └── exception/role.exception.ts              # TS|Exception|N-Lyr|POO|Role errors
│   │   │
│   │   ├── permission/                                  # Permisos Granulares
│   │   │   ├── controller/permission.controller.ts      # REST·RBAC|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/permission.service.ts            # RBAC·TS|Strategy|N-Lyr|Async·POO|Perm logic
│   │   │   ├── repository/permission.repository.ts      # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/permission.model.ts                # Prisma·TS|ActiveRecord|N-Lyr|POO|Perm entity
│   │   │   ├── dto/permission.dto.ts                    # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/permission.route.ts                # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/permission.schema.ts              # Zod|Schema|N-Lyr|Func|Validation
│   │   │   └── exception/permission.exception.ts        # TS|Exception|N-Lyr|POO|Perm errors
│   │   │
│   │   ├── ── PRODUCT DOMAIN ─────────────────────────────
│   │   │
│   │   ├── product/                                     # Catálogo de Productos
│   │   │   ├── controller/product.controller.ts         # REST·GraphQL|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/product.service.ts               # Cloudinary|Strategy|N-Lyr|Async·POO|Product logic
│   │   │   ├── repository/product.repository.ts         # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/product.model.ts                   # Prisma·TS|ActiveRecord|N-Lyr|POO|Product entity
│   │   │   ├── dto/product.dto.ts                       # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/product.route.ts                   # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/product.schema.ts                 # Zod|Schema|N-Lyr|Func|Validation
│   │   │   ├── types/product.types.ts                   # TS strict|VO|N-Lyr|Typed|Type defs
│   │   │   └── exception/product.exception.ts           # TS|Exception|N-Lyr|POO|Product errors
│   │   │
│   │   ├── category/                                    # Categorías y Taxonomía
│   │   │   ├── controller/category.controller.ts        # REST·GraphQL|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/category.service.ts              # Prisma·TS|Strategy|N-Lyr|Async·POO|Tree logic
│   │   │   ├── repository/category.repository.ts        # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/category.model.ts                  # Prisma·TS|Composite|N-Lyr|POO|Tree entity
│   │   │   ├── dto/category.dto.ts                      # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/category.route.ts                  # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/category.schema.ts                # Zod|Schema|N-Lyr|Func|Validation
│   │   │   └── exception/category.exception.ts          # TS|Exception|N-Lyr|POO|Cat errors
│   │   │
│   │   ├── brand/                                       # Marcas y Fabricantes
│   │   │   ├── controller/brand.controller.ts           # REST|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/brand.service.ts                 # Cloudinary|Strategy|N-Lyr|Async·POO|Brand logic
│   │   │   ├── repository/brand.repository.ts           # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/brand.model.ts                     # Prisma·TS|ActiveRecord|N-Lyr|POO|Brand entity
│   │   │   ├── dto/brand.dto.ts                         # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/brand.route.ts                     # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/brand.schema.ts                   # Zod|Schema|N-Lyr|Func|Validation
│   │   │   └── exception/brand.exception.ts             # TS|Exception|N-Lyr|POO|Brand errors
│   │   │
│   │   ├── collection/                                  # Colecciones y Lookbooks
│   │   │   ├── controller/collection.controller.ts      # REST·GraphQL|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/collection.service.ts            # Prisma·TS|Strategy|N-Lyr|Async·POO|Coll logic
│   │   │   ├── repository/collection.repository.ts      # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/collection.model.ts                # Prisma·TS|ActiveRecord|N-Lyr|POO|Coll entity
│   │   │   ├── dto/collection.dto.ts                    # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/collection.route.ts                # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/collection.schema.ts              # Zod|Schema|N-Lyr|Func|Validation
│   │   │   └── exception/collection.exception.ts        # TS|Exception|N-Lyr|POO|Coll errors
│   │   │
│   │   ├── ── COMMERCE DOMAIN ────────────────────────────
│   │   │
│   │   ├── cart/                                        # Carrito de Compras
│   │   │   ├── controller/cart.controller.ts            # REST|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/cart.service.ts                  # Redis·TS|Strategy|N-Lyr|Async·POO|Cart logic
│   │   │   ├── repository/cart.repository.ts            # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/cart.model.ts                      # Prisma·TS|ActiveRecord|N-Lyr|POO|Cart entity
│   │   │   ├── dto/cart.dto.ts                          # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/cart.route.ts                      # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/cart.schema.ts                    # Zod|Schema|N-Lyr|Func|Validation
│   │   │   └── exception/cart.exception.ts              # TS|Exception|N-Lyr|POO|Cart errors
│   │   │
│   │   ├── search/                                      # Búsqueda Avanzada
│   │   │   ├── controller/search.controller.ts          # REST·GraphQL|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/search.service.ts                # pgvector·FTS|Strategy|N-Lyr|Async·POO|Search logic
│   │   │   ├── util/spelling.util.ts                     # TS puro|Util|N-Lyr|Func|RF-06.1 Levenshtein
│   │   │   ├── repository/search.repository.ts          # PG·MongoDB|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/search.model.ts                    # Prisma·TS|ActiveRecord|N-Lyr|POO|Search entity
│   │   │   ├── dto/search.dto.ts                        # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/search.route.ts                    # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/search.schema.ts                  # Zod|Schema|N-Lyr|Func|Validation
│   │   │   └── exception/search.exception.ts            # TS|Exception|N-Lyr|POO|Search errors
│   │   │
│   │   ├── checkout/                                    # Checkout y Flujo de Compra
│   │   │   ├── controller/checkout.controller.ts        # REST·Stripe|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/checkout.service.ts              # Stripe·TS|Strategy|N-Lyr|Async·POO|Checkout logic
│   │   │   ├── repository/checkout.repository.ts        # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/checkout.model.ts                  # Prisma·TS|ActiveRecord|N-Lyr|POO|Session entity
│   │   │   ├── dto/checkout.dto.ts                      # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/checkout.route.ts                  # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/checkout.schema.ts                # Zod|Schema|N-Lyr|Func|Validation
│   │   │   └── exception/checkout.exception.ts          # TS|Exception|N-Lyr|POO|Checkout errors
│   │   │
│   │   ├── order/                                       # Gestión de Pedidos
│   │   │   ├── controller/order.controller.ts           # REST·GraphQL|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/order.service.ts                 # Prisma·TS|Strategy·Obs|N-Lyr|Async·POO|Order logic
│   │   │   ├── service/proof-nft.service.ts             # ethers·IPFS|Observer·Idempotency|N-Lyr|Async·POO|RF-29.3 NFT de prueba de compra
│   │   │   ├── repository/order.repository.ts           # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/order.model.ts                     # Prisma·TS|ActiveRecord|N-Lyr|POO|Order entity
│   │   │   ├── dto/order.dto.ts                         # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/order.route.ts                     # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/order.schema.ts                   # Zod|Schema|N-Lyr|Func|Validation
│   │   │   ├── event/order.event.ts                     # EventEmitter|Observer|N-Lyr|Event-Drv|Order events
│   │   │   └── exception/order.exception.ts             # TS|Exception|N-Lyr|POO|Order errors
│   │   │
│   │   ├── payment/                                     # Procesamiento de Pagos
│   │   │   ├── controller/payment.controller.ts         # REST·Stripe|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/payment.service.ts               # Stripe·TS|Strategy|N-Lyr|Async·POO|Payment logic
│   │   │   ├── repository/payment.repository.ts         # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/payment.model.ts                   # Prisma·TS|ActiveRecord|N-Lyr|POO|Payment entity
│   │   │   ├── dto/payment.dto.ts                       # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/payment.route.ts                   # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/payment.schema.ts                 # Zod|Schema|N-Lyr|Func|Validation
│   │   │   ├── util/payment.util.ts                     # Stripe·TS|Util|N-Lyr|Func|Format/calc
│   │   │   ├── service/risk.service.ts                  # Prisma·FastAPI|Facade|N-Lyr|Async·POO|RF-08.11 fraude
│   │   │   ├── util/crypto-payment.util.ts              # ethers·CoinGecko|Strategy|N-Lyr|Async·Func|RF-08.9 cripto
│   │   │   └── exception/payment.exception.ts           # TS|Exception|N-Lyr|POO|Payment errors
│   │   │
│   │   ├── shipping/                                    # Gestión de Envíos
│   │   │   ├── controller/shipping.controller.ts        # REST|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/shipping.service.ts              # Servient·DHL|Strategy|N-Lyr|Async·POO|Ship logic
│   │   │   ├── util/geo.util.ts                         # Axios·OSM|Adapter|N-Lyr|Async·Func|RF-08.2 geocodificación
│   │   │   ├── repository/shipping.repository.ts        # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/shipping.model.ts                  # Prisma·TS|ActiveRecord|N-Lyr|POO|Ship entity
│   │   │   ├── dto/shipping.dto.ts                      # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/shipping.route.ts                  # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/shipping.schema.ts                # Zod|Schema|N-Lyr|Func|Validation
│   │   │   └── exception/shipping.exception.ts          # TS|Exception|N-Lyr|POO|Ship errors
│   │   │
│   │   ├── ── FINANCE DOMAIN ─────────────────────────────
│   │   │
│   │   ├── invoice/                                     # Facturación Electrónica
│   │   │   ├── controller/invoice.controller.ts         # REST·DIAN|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/invoice.service.ts               # DIAN·TS|Strategy|N-Lyr|Async·POO|Invoice logic
│   │   │   ├── repository/invoice.repository.ts         # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/invoice.model.ts                   # Prisma·TS|ActiveRecord|N-Lyr|POO|Invoice entity
│   │   │   ├── dto/invoice.dto.ts                       # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/invoice.route.ts                   # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/invoice.schema.ts                 # Zod|Schema|N-Lyr|Func|Validation
│   │   │   ├── util/pdf.util.ts                         # PDFKit·TS|Util|N-Lyr|Func|PDF generate
│   │   │   └── exception/invoice.exception.ts           # TS|Exception|N-Lyr|POO|Invoice errors
│   │   │
│   │   ├── refund/                                      # Devoluciones y Cambios
│   │   │   ├── controller/refund.controller.ts          # REST·Stripe|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/refund.service.ts                # Stripe·TS|Strategy|N-Lyr|Async·POO|Refund logic
│   │   │   ├── repository/refund.repository.ts          # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/refund.model.ts                    # Prisma·TS|ActiveRecord|N-Lyr|POO|Refund entity
│   │   │   ├── dto/refund.dto.ts                        # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/refund.route.ts                    # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/refund.schema.ts                  # Zod|Schema|N-Lyr|Func|Validation
│   │   │   └── exception/refund.exception.ts            # TS|Exception|N-Lyr|POO|Refund errors
│   │   │
│   │   ├── coupon/                                      # Cupones y Descuentos
│   │   │   ├── controller/coupon.controller.ts          # REST|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/coupon.service.ts                # Redis·TS|Strategy|N-Lyr|Async·POO|Coupon logic
│   │   │   ├── service/promotion.service.ts             # Prisma·Redis|Facade·Observer|N-Lyr|Async·POO|RF-13.4/13.7-13.10 promociones
│   │   │   ├── model/promotion.model.ts                 # TS puro|Strategy|N-Lyr|Func|Reglas 2x1, escalonado, flash, prioridad
│   │   │   ├── schema/promotion.schema.ts               # Zod|Schema|N-Lyr|Func|Validación de promociones
│   │   │   ├── controller/promotion.controller.ts       # REST|Guard|N-Lyr|Async·POO|/promotion
│   │   │   ├── route/promotion.route.ts                 # Express·Router|Chain-Resp|N-Lyr|Async|Rutas promociones
│   │   │   ├── repository/coupon.repository.ts          # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/coupon.model.ts                    # Prisma·TS|ActiveRecord|N-Lyr|POO|Coupon entity
│   │   │   ├── dto/coupon.dto.ts                        # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/coupon.route.ts                    # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/coupon.schema.ts                  # Zod|Schema|N-Lyr|Func|Validation
│   │   │   └── exception/coupon.exception.ts            # TS|Exception|N-Lyr|POO|Coupon errors
│   │   │
│   │   ├── ── LOYALTY & ENGAGEMENT DOMAIN ─────────────────
│   │   │
│   │   ├── loyalty/                                     # Programa de Fidelidad + NFT
│   │   │   ├── controller/loyalty.controller.ts         # REST·Web3|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/loyalty.service.ts               # Web3·IPFS|Strategy|N-Lyr|Async·POO|Loyalty logic
│   │   │   ├── repository/loyalty.repository.ts         # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/loyalty.model.ts                   # Prisma·TS|ActiveRecord|N-Lyr|POO|Points entity
│   │   │   ├── dto/loyalty.dto.ts                       # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/loyalty.route.ts                   # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/loyalty.schema.ts                 # Zod|Schema|N-Lyr|Func|Validation
│   │   │   ├── util/nft.util.ts                         # ethers·IPFS|Util|N-Lyr|Async·Func|NFT mint
│   │   │   └── exception/loyalty.exception.ts           # TS|Exception|N-Lyr|POO|Loyalty errors
│   │   │
│   │   ├── review/                                      # Comentarios y Reseñas
│   │   │   ├── controller/review.controller.ts          # REST·GraphQL|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/review.service.ts                # Prisma·TS|Strategy|N-Lyr|Async·POO|Review logic
│   │   │   ├── repository/review.repository.ts          # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/review.model.ts                    # Prisma·TS|ActiveRecord|N-Lyr|POO|Review entity
│   │   │   ├── dto/review.dto.ts                        # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/review.route.ts                    # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/review.schema.ts                  # Zod|Schema|N-Lyr|Func|Validation
│   │   │   └── exception/review.exception.ts            # TS|Exception|N-Lyr|POO|Review errors
│   │   │
│   │   ├── notification/                                # Notificaciones Multicanal
│   │   │   ├── controller/notification.controller.ts    # REST·WS|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/notification.service.ts          # FCM·WS·TS|Observer|N-Lyr|Async·POO|Notify logic
│   │   │   ├── provider/whatsapp.provider.ts            # WhatsApp Cloud API|Strategy·Adapter|N-Lyr|Async·POO|RF-16.1 WhatsApp
│   │   │   ├── repository/notification.repository.ts    # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/notification.model.ts              # Prisma·TS|ActiveRecord|N-Lyr|POO|Notif entity
│   │   │   ├── dto/notification.dto.ts                  # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/notification.route.ts              # Express·WS|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/notification.schema.ts            # Zod|Schema|N-Lyr|Func|Validation
│   │   │   ├── event/notification.event.ts              # EventEmitter|Observer|N-Lyr|Event-Drv|Notif events
│   │   │   ├── provider/sms.provider.ts                 # Twilio REST·axios|Strategy·Adapter·Factory|N-Lyr|Async·POO|SMS (RF-01.1)
│   │   │   └── exception/notification.exception.ts      # TS|Exception|N-Lyr|POO|Notif errors
│   │   │
│   │   ├── ── SOCIAL & AUTOMATION DOMAIN ──────────────────
│   │   │
│   │   ├── social-commerce/                             # Social Commerce
│   │   │   ├── controller/social.controller.ts          # REST·GraphQL|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/social.service.ts                # Instagram·TS|Strategy|N-Lyr|Async·POO|Social logic
│   │   │   ├── service/channel.service.ts               # Meta·TikTok Shop|Facade·Observer|N-Lyr|Async·POO|RF-19.1/19.3/19.10 catálogo y pedidos
│   │   │   ├── service/engagement.service.ts            # Mongoose|Facade·State|N-Lyr|Async·POO|RF-19.9 Live Shopping · RF-19.11 UGC
│   │   │   ├── provider/catalog.provider.ts             # Graph API·TikTok Open API|Strategy·Adapter|N-Lyr|Async·POO|RF-19.7 canales oficiales
│   │   │   ├── model/channel.model.ts                   # Mongoose|ActiveRecord|N-Lyr|POO|Listados, lives y UGC
│   │   │   ├── repository/social.repository.ts          # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/social.model.ts                    # Prisma·TS|ActiveRecord|N-Lyr|POO|Post entity
│   │   │   ├── dto/social.dto.ts                        # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/social.route.ts                    # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/social.schema.ts                  # Zod|Schema|N-Lyr|Func|Validation
│   │   │   └── exception/social.exception.ts            # TS|Exception|N-Lyr|POO|Social errors
│   │   │
│   │   ├── automation/                                  # Automatización n8n
│   │   │   ├── controller/automation.controller.ts      # REST·n8n|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/automation.service.ts            # n8n·TS|Strategy|N-Lyr|Async·POO|Flow logic
│   │   │   ├── model/automation.templates.ts            # n8n JSON|Prototype·Builder|N-Lyr|Func|RF-20.2/20.8 plantillas de flujos
│   │   │   ├── repository/automation.repository.ts      # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/automation.model.ts                # Prisma·TS|ActiveRecord|N-Lyr|POO|Workflow entity
│   │   │   ├── dto/automation.dto.ts                    # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/automation.route.ts                # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/automation.schema.ts              # Zod|Schema|N-Lyr|Func|Validation
│   │   │   └── exception/automation.exception.ts        # TS|Exception|N-Lyr|POO|Auto errors
│   │   │
│   │   ├── communication/                               # Comunicación y Chat
│   │   │   ├── controller/communication.controller.ts   # REST·WS|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/communication.service.ts         # Socket.io|Observer|N-Lyr|Async·POO|Chat logic
│   │   │   ├── provider/chatwoot.provider.ts            # Chatwoot API|Adapter·Null Object|N-Lyr|Async·POO|RF-17.11 hub de agentes
│   │   │   ├── service/contact.service.ts               # Mongoose·Nodemailer|Facade·State|N-Lyr|Async·POO|RF-21.2 formulario de contacto
│   │   │   ├── repository/communication.repository.ts   # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/communication.model.ts             # Prisma·TS|ActiveRecord|N-Lyr|POO|Conv entity
│   │   │   ├── dto/communication.dto.ts                 # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/communication.route.ts             # Express·WS|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/communication.schema.ts           # Zod|Schema|N-Lyr|Func|Validation
│   │   │   ├── event/communication.event.ts             # Socket.io|Observer|N-Lyr|Event-Drv|WS events
│   │   │   └── exception/communication.exception.ts     # TS|Exception|N-Lyr|POO|Comm errors
│   │   │
│   │   ├── ── ANALYTICS DOMAIN ────────────────────────────
│   │   │
│   │   ├── analytics/                                   # Analytics y Métricas
│   │   │   ├── controller/analytics.controller.ts       # REST·GraphQL|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/analytics.service.ts             # Prisma·PG|CQRS·Strategy|N-Lyr|Async·POO|Metrics logic
│   │   │   ├── service/advanced.service.ts              # Mongoose·Prisma|Facade·Observer|N-Lyr|Async·POO|RF-24.6/24.8/24.10/24.11/24.12 + RF-22.9
│   │   │   ├── model/attribution.model.ts               # TS puro|Strategy|N-Lyr|Func|Modelos de atribución multitoque
│   │   │   ├── repository/analytics.repository.ts       # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/analytics.model.ts                 # Prisma·TS|ActiveRecord|N-Lyr|POO|Event entity
│   │   │   ├── dto/analytics.dto.ts                     # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/analytics.route.ts                 # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/analytics.schema.ts               # Zod|Schema|N-Lyr|Func|Validation
│   │   │   ├── event/analytics.event.ts                 # EventEmitter|Observer|N-Lyr|Event-Drv|Track events
│   │   │   └── exception/analytics.exception.ts         # TS|Exception|N-Lyr|POO|Analytics err
│   │   │
│   │   ├── ── OPERATIONS DOMAIN ───────────────────────────
│   │   │
│   │   ├── inventory/                                   # Gestión de Inventario
│   │   │   ├── controller/inventory.controller.ts       # REST|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/inventory.service.ts             # Prisma·TS|Strategy|N-Lyr|Async·POO|Stock logic
│   │   │   ├── repository/inventory.repository.ts       # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/inventory.model.ts                 # Prisma·TS|ActiveRecord|N-Lyr|POO|Stock entity
│   │   │   ├── dto/inventory.dto.ts                     # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/inventory.route.ts                 # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/inventory.schema.ts               # Zod|Schema|N-Lyr|Func|Validation
│   │   │   ├── event/inventory.event.ts                 # EventEmitter|Observer|N-Lyr|Event-Drv|Stock events
│   │   │   └── exception/inventory.exception.ts         # TS|Exception|N-Lyr|POO|Inventory err
│   │   │
│   │   ├── supplier/                                    # Gestión de Proveedores
│   │   │   ├── controller/supplier.controller.ts        # REST|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/supplier.service.ts              # Prisma·TS|Strategy|N-Lyr|Async·POO|Supplier logic
│   │   │   ├── service/purchase-order.service.ts        # Prisma·PDFKit|Facade·State|N-Lyr|Async·POO|RF-23.3/23.5/23.6/23.8/23.9 compras
│   │   │   ├── repository/purchase-order.repository.ts  # Prisma·SQL|Repository|N-Lyr|Async·POO|Órdenes, ranking, precios, capas de costo
│   │   │   ├── model/procurement.model.ts               # TS puro|State·Strategy|N-Lyr|Func|Ranking, FIFO/promedio, cuentas por pagar
│   │   │   ├── controller/purchase-order.controller.ts  # REST|Controller|N-Lyr|Async·POO|/supplier/purchase-order
│   │   │   ├── schema/purchase-order.schema.ts          # Zod|Schema|N-Lyr|Func|Validación de compras
│   │   │   ├── repository/supplier.repository.ts        # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/supplier.model.ts                  # Prisma·TS|ActiveRecord|N-Lyr|POO|Supplier entity
│   │   │   ├── dto/supplier.dto.ts                      # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/supplier.route.ts                  # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/supplier.schema.ts                # Zod|Schema|N-Lyr|Func|Validation
│   │   │   └── exception/supplier.exception.ts          # TS|Exception|N-Lyr|POO|Supplier errors
│   │   │
│   │   ├── ── AI DOMAIN ──────────────────────────────────
│   │   │
│   │   ├── recommendation/                              # Recomendaciones IA (LangChain)
│   │   │   ├── controller/recommendation.controller.ts  # REST·LC|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/recommendation.service.ts        # LangChain|Strategy|N-Lyr|Async·POO|AI logic
│   │   │   ├── service/home-feed.service.ts             # Prisma·SQL|Chain-Resp|N-Lyr|Async·Func|RF-18.7 portada por contexto
│   │   │   ├── repository/recommendation.repository.ts  # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/recommendation.model.ts            # Prisma·TS|ActiveRecord|N-Lyr|POO|Rec entity
│   │   │   ├── dto/recommendation.dto.ts                # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/recommendation.route.ts            # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/recommendation.schema.ts          # Zod|Schema|N-Lyr|Func|Validation
│   │   │   ├── ml/recommendation.ml.ts                  # LangChain|Pipeline|N-Lyr|Async·Data|AI pipeline
│   │   │   └── exception/recommendation.exception.ts    # TS|Exception|N-Lyr|POO|Rec errors
│   │   │
│   │   ├── graph-analysis/                              # Análisis Relacional IA (LangGraph)
│   │   │   ├── controller/graph.controller.ts           # REST·LG|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/graph.service.ts                 # LangGraph|Strategy|N-Lyr|Async·POO|Graph logic
│   │   │   ├── repository/graph.repository.ts           # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/graph.model.ts                     # Prisma·TS|ActiveRecord|N-Lyr|POO|Graph entity
│   │   │   ├── dto/graph.dto.ts                         # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/graph.route.ts                     # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/graph.schema.ts                   # Zod|Schema|N-Lyr|Func|Validation
│   │   │   ├── ml/graph.ml.ts                           # LangGraph|Pipeline|N-Lyr|Async·Data|Graph pipeline
│   │   │   └── exception/graph.exception.ts             # TS|Exception|N-Lyr|POO|Graph errors
│   │   │
│   │   ├── ── INTEGRATION DOMAIN ──────────────────────────
│   │   │
│   │   ├── email/                                       # Email (Nodemailer)
│   │   │   ├── controller/email.controller.ts           # REST|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/email.service.ts                 # Nodemailer|Strategy|N-Lyr|Async·POO|Email logic
│   │   │   ├── util/blocks.util.ts                      # TS·crypto|Builder·Interpreter|N-Lyr|Func|RF-21.5 clics firmados · RF-21.6 diseñador
│   │   │   ├── repository/email.repository.ts           # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/email.model.ts                     # Prisma·TS|ActiveRecord|N-Lyr|POO|Email entity
│   │   │   ├── dto/email.dto.ts                         # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/email.route.ts                     # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/email.schema.ts                   # Zod|Schema|N-Lyr|Func|Validation
│   │   │   ├── util/template.util.ts                    # TS·template|Util|N-Lyr|Func|HTML templates
│   │   │   ├── provider/email.provider.ts               # TS|Strategy|N-Lyr|Async·POO|Provider port
│   │   │   ├── provider/smtp.provider.ts                # Nodemailer|Adapter|N-Lyr|Async·POO|SMTP (default)
│   │   │   ├── provider/azure.provider.ts               # Azure ACS|Adapter|N-Lyr|Async·POO|Azure ⚠️ opcional
│   │   │   └── exception/email.exception.ts             # TS|Exception|N-Lyr|POO|Email errors
│   │   │
│   │   ├── webhook/                                     # Webhooks
│   │   │   ├── controller/webhook.controller.ts         # REST|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/webhook.service.ts               # Axios·TS|Observer|N-Lyr|Async·POO|Hook logic
│   │   │   ├── repository/webhook.repository.ts         # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/webhook.model.ts                   # Prisma·TS|ActiveRecord|N-Lyr|POO|Hook entity
│   │   │   ├── dto/webhook.dto.ts                       # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/webhook.route.ts                   # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/webhook.schema.ts                 # Zod|Schema|N-Lyr|Func|Validation
│   │   │   ├── handler/webhook.handler.ts               # Axios·TS|Handler|N-Lyr|Async·POO|Event dispatch
│   │   │   └── exception/webhook.exception.ts           # TS|Exception|N-Lyr|POO|Hook errors
│   │   │
│   │   ├── mcp-server/                                  # MCP Server (Model Context Protocol)
│   │   │   ├── controller/mcp.controller.ts             # REST·MCP|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/mcp.service.ts                   # MCP·SDK·TS|Strategy|N-Lyr|Async·POO|MCP logic
│   │   │   ├── repository/mcp.repository.ts             # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/mcp.model.ts                       # Prisma·TS|ActiveRecord|N-Lyr|POO|Tx entity
│   │   │   ├── dto/mcp.dto.ts                           # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/mcp.route.ts                       # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/mcp.schema.ts                     # Zod|Schema|N-Lyr|Func|Validation
│   │   │   ├── saga/mcp.saga.ts                         # MCP·SDK|Saga·Command|N-Lyr|Async·POO|Compensation
│   │   │   └── exception/mcp.exception.ts               # TS|Exception|N-Lyr|POO|MCP errors
│   │   │
│   │   ├── marketing/                                   # Marketing Automation
│   │   │   ├── controller/marketing.controller.ts       # REST|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/marketing.service.ts             # HubSpot·TS|Strategy|N-Lyr|Async·POO|Campaign logic
│   │   │   ├── model/ab-test.model.ts                   # TS puro|Strategy|N-Lyr|Func|RF-21.4 pruebas A/B
│   │   │   ├── repository/marketing.repository.ts       # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/marketing.model.ts                 # Prisma·TS|ActiveRecord|N-Lyr|POO|Campaign entity
│   │   │   ├── dto/marketing.dto.ts                     # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/marketing.route.ts                 # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/marketing.schema.ts               # Zod|Schema|N-Lyr|Func|Validation
│   │   │   └── exception/marketing.exception.ts         # TS|Exception|N-Lyr|POO|Mktg errors
│   │   │
│   │   ├── crm/                                         # CRM - Gestión de Clientes
│   │   │   ├── controller/crm.controller.ts             # REST·GraphQL|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/crm.service.ts                   # HubSpot·TS|Strategy|N-Lyr|Async·POO|CRM logic
│   │   │   ├── service/retention.service.ts             # Prisma·SQL|Service|N-Lyr|Async·Func|RF-16.3/18.8/20.8 churn, reactivación y ofertas
│   │   │   ├── service/insight.service.ts               # Prisma·Mongoose|Facade·Interpreter|N-Lyr|Async·POO|RF-22.2/22.4/22.6/22.7/22.8/22.10
│   │   │   ├── model/insight.model.ts                   # TS puro·Zod|Rules Engine|N-Lyr|Func|Segmentos, NBA, anomalías, CSV, cohortes
│   │   │   ├── repository/crm.repository.ts             # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/crm.model.ts                       # Prisma·TS|ActiveRecord|N-Lyr|POO|Customer entity
│   │   │   ├── dto/crm.dto.ts                           # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/crm.route.ts                       # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/crm.schema.ts                     # Zod|Schema|N-Lyr|Func|Validation
│   │   │   └── exception/crm.exception.ts               # TS|Exception|N-Lyr|POO|CRM errors
│   │   │
│   │   ├── ── MEDIA & ADMIN DOMAIN ────────────────────────
│   │   │
│   │   ├── audit-log/                                   # Logs y Auditoría
│   │   │   ├── controller/audit.controller.ts           # REST|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/audit.service.ts                 # Winston·TS|Observer|N-Lyr|Async·POO|Audit logic
│   │   │   ├── service/audit-insight.service.ts         # PDFKit·Socket.io|Facade·Observer|N-Lyr|Async·POO|RF-30.3 CSV/PDF · 30.4 anomalías · 30.7 compliance · 30.8 tiempo real
│   │   │   ├── model/anomaly.model.ts                   # TS puro|Strategy|N-Lyr|Func|RF-30.4 reglas de anomalías
│   │   │   ├── repository/audit.repository.ts           # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/audit.model.ts                     # Prisma·TS|ActiveRecord|N-Lyr|POO|Log entity
│   │   │   ├── dto/audit.dto.ts                         # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/audit.route.ts                     # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/audit.schema.ts                   # Zod|Schema|N-Lyr|Func|Validation
│   │   │   └── exception/audit.exception.ts             # TS|Exception|N-Lyr|POO|Audit errors
│   │   │
│   │   ├── media/                                       # Gestión de Medios (Cloudinary)
│   │   │   ├── controller/media.controller.ts           # REST·Cloud|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/media.service.ts                 # Cloudinary|Strategy|N-Lyr|Async·POO|Upload logic
│   │   │   ├── service/media-ops.service.ts             # Cloudinary·Mongoose|Facade·Memento|N-Lyr|Async·POO|RF-26.4 uso, respaldo y restauración
│   │   │   ├── repository/media.repository.ts           # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/media.model.ts                     # Prisma·TS|ActiveRecord|N-Lyr|POO|Media entity
│   │   │   ├── dto/media.dto.ts                         # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/media.route.ts                     # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/media.schema.ts                   # Zod|Schema|N-Lyr|Func|Validation
│   │   │   ├── util/image.util.ts                       # Multer·TS|Util|N-Lyr|Func|Transform/resize
│   │   │   ├── util/vision.util.ts                      # Axios·FastAPI|Adapter|N-Lyr|Async·Func|RF-06.6 inspección
│   │   │   └── exception/media.exception.ts             # TS|Exception|N-Lyr|POO|Media errors
│   │   │
│   │   ├── dashboard/                                   # Dashboard Admin
│   │   │   ├── controller/dashboard.controller.ts       # REST·GraphQL|Guard|N-Lyr|Async·POO|HTTP routing
│   │   │   ├── service/dashboard.service.ts             # Prisma·TS|Facade|N-Lyr|Async·POO|Aggregate logic
│   │   │   ├── repository/dashboard.repository.ts       # Prisma·PG|Repository|N-Lyr|Async·POO|DB queries
│   │   │   ├── model/dashboard.model.ts                 # Prisma·TS|ActiveRecord|N-Lyr|POO|Widget entity
│   │   │   ├── dto/dashboard.dto.ts                     # Zod·TS|DTO|N-Lyr|Func|I/O contracts
│   │   │   ├── route/dashboard.route.ts                 # Express|Chain-Resp|N-Lyr|Async|Route config
│   │   │   ├── schema/dashboard.schema.ts               # Zod|Schema|N-Lyr|Func|Validation
│   │   │   └── exception/dashboard.exception.ts         # TS|Exception|N-Lyr|POO|Dash errors
│   │   │
│   │   └── cms/                                         # CMS (Fase 8: lo administra Nuxt) — páginas, landings, lookbooks, eventos, leads y config de tienda
│   │       ├── controller/cms.controller.ts             # REST|Guard|N-Lyr|Async·POO|HTTP routing
│   │       ├── service/cms.service.ts                   # Mongoose·Redis|Strategy·Cache-Aside·Observer|N-Lyr|Async·POO|Content logic
│   │       ├── repository/cms.repository.ts             # Mongoose·Mongo|Repository|N-Lyr|Async·POO|DB queries
│   │       ├── model/cms.model.ts                       # Mongoose·TS|STI|N-Lyr|POO|CmsContent·CmsLead·StoreConfig
│   │       ├── dto/cms.dto.ts                           # TS|DTO|N-Lyr|Func|I/O contracts
│   │       ├── route/cms.route.ts                       # Express|Chain-Resp·Guard|N-Lyr|Async|Route config
│   │       ├── schema/cms.schema.ts                     # Zod|Schema·Strategy|N-Lyr|Func|Validation
│   │       └── exception/cms.exception.ts               # TS|Exception|N-Lyr|POO|CMS errors
│   │
│   ├── shared/                                          # Código compartido entre módulos
│   │   ├── middleware/
│   │   │   ├── jwt.middleware.ts                        # JWT·Passport|Guard|N-Lyr|Async·POO|Token validate
│   │   │   ├── rbac.middleware.ts                       # RBAC·TS|Guard|N-Lyr|Async·POO|Role check
│   │   │   ├── rate-limit.middleware.ts                 # Redis·TS|Throttle|N-Lyr|Async|Rate limiting
│   │   │   ├── upload.middleware.ts                     # Multer·TS|Factory|N-Lyr|Async|Excel/CSV upload (RF-04.3)
│   │   │   ├── idempotency.middleware.ts                # Redis·TS|Chain-Resp·Proxy|N-Lyr|Async|RF-28.7 reintentos sin duplicados
│   │   │   ├── cors.middleware.ts                       # CORS·TS|Middleware|N-Lyr|Async|CORS policy
│   │   │   ├── logger.middleware.ts                     # Winston·TS|Observer|N-Lyr|Async|Request log
│   │   │   └── error.middleware.ts                      # TS|Chain-Resp|N-Lyr|POO|Error handler
│   │   ├── interceptor/
│   │   │   ├── cache.interceptor.ts                     # Redis·TS|Decorator|N-Lyr|Async|Cache layer
│   │   │   └── transform.interceptor.ts                 # TS|Adapter|N-Lyr|Func|Response wrap
│   │   ├── decorator/
│   │   │   ├── auth.decorator.ts                        # JWT·TS|Decorator|N-Lyr|POO|Auth annotate
│   │   │   └── validate.decorator.ts                    # Zod·TS|Decorator|N-Lyr|Func|Input annotate
│   │   ├── filter/
│   │   │   └── http-exception.filter.ts                 # TS|Chain-Resp|N-Lyr|POO|Exception map
│   │   ├── pipe/
│   │   │   ├── validation.pipe.ts                       # Zod·TS|Decorator|N-Lyr|Func|Input validate
│   │   │   └── transform.pipe.ts                        # TS|Adapter|N-Lyr|Func|Type coerce
│   │   ├── util/
│   │   │   ├── pagination.util.ts                       # TS|Util|N-Lyr|Func|Cursor paginate
│   │   │   ├── crypto.util.ts                           # crypto·TS|Util|N-Lyr|Func|Hash/encrypt
│   │   │   ├── date.util.ts                             # Date·TS|Util|N-Lyr|Func|Date format
│   │   │   ├── event-bus.util.ts                        # EventEmitter|Observer|N-Lyr|Reactivo|Domain events
│   │   │   ├── i18n.util.ts                             # TS|Util|N-Lyr|Func|Backend es/en
│   │   │   ├── slugify.util.ts                          # TS|Util|N-Lyr|Func|URL slugs
│   │   │   ├── spreadsheet.util.ts                      # node:zlib·TS|Adapter·Strategy|N-Lyr|Func|CSV + XLSX sin dependencias (RF-04.3)
│   │   │   └── web-push.util.ts                         # node:crypto|Adapter|N-Lyr|Func|Web Push VAPID (RFC 8291/8292)
│   │   ├── types/
│   │   │   ├── common.types.ts                          # TS strict|VO|N-Lyr|Typed|Shared types
│   │   │   ├── pagination.types.ts                      # TS strict|VO|N-Lyr|Typed|Pagination types
│   │   │   └── api-response.types.ts                    # TS strict|VO|N-Lyr|Typed|HTTP response
│   │   └── constants/
│   │       ├── http.constants.ts                        # TS|Config|N-Lyr|Typed|HTTP codes
│   │       ├── messages.constants.ts                    # TS|Config|N-Lyr|Typed|i18n messages
│   │       └── roles.constants.ts                       # RBAC·TS|Config|N-Lyr|Typed|Role names
│   │
│   ├── config/                                          # Configuración global
│   │   ├── app.config.ts                                # dotenv·TS|Singleton|N-Lyr|POO|App config
│   │   ├── database.config.ts                           # Prisma·PG|Singleton|N-Lyr|POO|DB connection
│   │   ├── redis.config.ts                              # Redis·TS|Singleton|N-Lyr|POO|Cache config
│   │   ├── jwt.config.ts                                # JWT·TS|Singleton|N-Lyr|POO|Token config
│   │   ├── passport.config.ts                           # Passport·TS|Strategy|N-Lyr|POO|JWT/OAuth setup
│   │   ├── azure.config.ts                              # Azure·TS|Singleton|N-Lyr|POO|Azure ⚠️ opcional
│   │   ├── graphql.config.ts                            # Apollo·TS|Singleton|N-Lyr|POO|GQL config
│   │   ├── stripe.config.ts                             # Stripe·TS|Singleton|N-Lyr|POO|Payment config
│   │   ├── cloudinary.config.ts                         # Cloud·TS|Singleton|N-Lyr|POO|Media config
│   │   ├── socket.config.ts                             # Socket.io|Singleton|N-Lyr|POO|WS config
│   │   └── swagger.config.ts                            # SwaggerUI·TS|Singleton|N-Lyr|POO|API docs
│   │
│   ├── app.ts                                           # Express·TS|Facade|N-Lyr|POO|App bootstrap
│   ├── bootstrap.ts                                     # Node·TS|Facade|N-Lyr|Async|Secrets/DB init
│   └── server.ts                                        # Node·TS|Singleton|N-Lyr|POO|HTTP listen
│
├── prisma/
│   ├── schema.prisma                                    # Prisma·PG|Schema|N-Lyr|Typed|DB schema
│   ├── migrations/                                      # Prisma|Migration|N-Lyr|-|DB versions
│   └── seed.ts                                          # Prisma·TS|Factory|N-Lyr|Async|DB seed
│
├── test/
│   ├── unit/                                            # Jest·TS|-|N-Lyr|-|Unit tests
│   ├── integration/                                     # Jest·Super|-|N-Lyr|-|Integration tests
│   └── e2e/                                             # Jest·Super|-|N-Lyr|-|E2E tests
│
├── .env                                                 # -|Config|-|-|Env variables
├── .env.example                                         # -|Config|-|-|Env template
├── tsconfig.json                                        # TS strict|Config|-|-|TS config
├── jest.config.ts                                       # Jest·TS|Config|-|-|Test config
├── Dockerfile                                           # Docker|Infra|-|-|Container
└── package.json                                         # pnpm·TS|Config|-|-|Dependencies
```

---

## ABREVIATURAS

| Abr.         | Significado                              |
|--------------|------------------------------------------|
| N-Lyr        | N-Layer Architecture                     |
| POO          | Programación Orientada a Objetos         |
| Async        | Asynchronous (non-blocking)              |
| Func         | Functional Programming                   |
| Event-Drv    | Event-Driven Programming                 |
| Data         | Data-Driven Programming                  |
| Typed        | Strongly Typed                           |
| Strat        | Strategy Pattern                         |
| Repo         | Repository Pattern                       |
| Guard        | Guard / Middleware Pattern               |
| Obs          | Observer Pattern                         |
| Adapt        | Adapter Pattern                          |
| Fact         | Factory Pattern                          |
| CQRS         | Command Query Responsibility Segregation |
| Chain-Resp   | Chain of Responsibility Pattern          |
| VO           | Value Object                             |
| Sing         | Singleton Pattern                        |
| DTO          | Data Transfer Object                     |
| ORM          | Object Relational Mapper                 |
| JWT          | JSON Web Token                           |
| RBAC         | Role-Based Access Control                |
| PG           | PostgreSQL                               |
| LC           | LangChain                                |
| LG           | LangGraph                                |
| Cloud        | Cloudinary                               |
| WS           | WebSocket                                |
| MCP          | Model Context Protocol                   |
| GQL          | GraphQL                                  |

---

## ESTADO DE IMPLEMENTACIÓN — v35 (Fases 0–4)

> Política del proyecto: **solo tecnologías open source o gratuitas**. La columna de tecnología del árbol se actualizó donde la implementación usa una alternativa libre o nativa.

| Antes (v34) | Ahora (v35) | Motivo |
|-------------|-------------|--------|
| Auth0 (SaaS propietario) | JWT propio + refresh rotativo + bcrypt + Passport JWT + 2FA email | Open source, sin límite de usuarios ni costo |
| Passport OAuth2 por proveedor | next-auth en el frontend + verificación del `access_token` contra el perfil del proveedor (`axios`) | Evita una estrategia duplicada por proveedor |
| Web3.js / wagmi en el backend | `ethers` v6 (SIWE `verifyMessage`, ERC-721 `safeMint`) | Una sola librería Web3; wagmi es de frontend |
| ipfs-http-client | API RPC de Kubo (`/api/v0/add`) con `axios` | Paquete deprecado y solo ESM |
| FAISS en `search` | PostgreSQL FTS (español) + pgvector HNSW | Búsqueda en la misma base; FAISS queda para FastAPI (Fase 5) |
| FedEx · DHL (API) | Strategy de transportadoras con tarifas locales: Servientrega (nacional) y DHL (internacional) | Sin credenciales de pago; se conecta a la API real cambiando la estrategia |
| Handlebars | Plantillas como funciones puras de TypeScript | Tipadas, sin motor extra |
| Sharp | Transformaciones de Cloudinary (`f_auto`, `q_auto`) | Evita procesar dos veces |
| dayjs | `Date` nativo | Aritmética de fechas mínima |
| swagger-jsdoc | OpenAPI 3.0 generado desde las rutas (`config/swagger.config.ts`) + swagger-ui-express | La documentación no se desactualiza |
| Azure (Key Vault, Application Insights, Communication Services) | Opcional con `AZURE_ENABLED=true` (apagado por defecto); respaldo gratuito automático: `.env`, logs winston, Nodemailer + SMTP | Servicios de pago: se usan solo si están disponibles |

**RF 01–05 (10/10/2026):** Auth: Facebook y Apple (`POST /auth/oauth`; Apple valida el id_token con el JWKS de Apple), enlace mágico (`POST /auth/magic-link`, `POST /auth/magic-link/verify`), verificación del celular por SMS (`POST /auth/phone/code`, `POST /auth/phone/verify`; `notification/provider/sms.provider.ts`, Twilio o log en desarrollo) y correo de bienvenida (evento `user.welcome`). User: `GET /user/:id/export` (GDPR, JSON). Payment: métodos guardados tokenizados en Stripe (`GET/POST /payment/methods`, `/methods/setup-intent`, `PATCH/DELETE /payment/methods/:methodId`). Role: jerarquía `parentId` con herencia de permisos en `rbac.middleware` y regla anti-ciclos. Product: insignias `badges` (?badge=), `POST /product/:id/duplicate`, `PATCH /product/bulk`, `GET /product/export?format=xlsx|csv`, `POST /product/import` (multipart; `shared/util/spreadsheet.util.ts` + `shared/middleware/upload.middleware.ts`) y avisos de lista de deseos (bajada de precio / vuelve a haber stock). Brand: `story`, `country`, `isPremium`, `isExclusive`, `GET /brand/:id/stats` (solo ADMIN). Collection: `lookDiscountPercent` aplicado en el checkout (descuento por look completo). Migración `20261010000000_rf_01_05_auth_users_catalog`. Pruebas: `test/unit/rf01-05.spec.ts`.

Módulos implementados: auth, user, role, permission, product, category, brand, collection, cart, search, checkout, order, payment, shipping, invoice, refund, coupon, loyalty, review, notification, email (servicio + plantillas) y media (capas controller/service/repository/model/dto/schema/util/exception). Endpoint agregado respecto a la matriz: `POST /api/v1/auth/web3/link` (vincular wallet a la cuenta, requisito del login Web3 y del minteo de NFT). El resto de módulos del árbol corresponde a fases 5–11.

**Fase 8 (05/10/2026):** módulo `cms` (MongoDB) que consume Nuxt: `GET/POST /cms/:kind`, `GET /cms/:kind/:slug`, `PATCH/DELETE /cms/:kind/:id` (kind = page | landing | lookbook | event; Single Table Inheritance con `data` validado por tipo), `POST /cms/landing/:slug/lead` (rate limit 5/10 min, consentimiento obligatorio), `GET /cms/lead`, `GET /cms/config` (vista pública sin billeteras) y `PUT /cms/config/:section` (payment | shipping | tax | currency; sin secretos). Lecturas públicas cacheadas 10 min en Redis; el HTML de GrapesJS se sanea al guardar; cada cambio emite el webhook `cms.updated` (Nuxt purga su ISR). Notificaciones: el canal PUSH envía también Web Push estándar (VAPID + aes128gcm con `node:crypto`, sin librerías) a las suscripciones de la PWA. Pruebas: `test/unit/phase8.spec.ts`.


---

## FASE 9 (05/10/2026) — Módulos de alto rendimiento en Express (Rust queda para el futuro)

> Decisión del responsable: los 6 módulos de la hoja `🦀 Rust Axum` se implementan **por ahora en Express** (open source, sin costo). Rust sigue documentado en el Excel, el Word y el Plan de Trabajo (sprints 9.1 a 9.3) para una implementación futura. Se conservan los **mismos nombres de módulo, entidad y archivo**; solo cambia la extensión (`.rs` → `.ts`) y `mod.rs` pasa a `index.ts`. Estado de los 6 módulos: **Implementados (06/10/2026)** — ver «Implementación Fase 9» al final de esta sección.

| Tema | Decisión |
|------|----------|
| Carpeta `inventory` | Pasa a `realtime_inventory/` porque `src/module/inventory/` ya existe (inventario transaccional, sprint 7.2) |
| Rutas REST | `/api/v1/rt/...` (las rutas de Rust, con el segmento `rt`), porque `/api/v1/inventory` y `/api/v1/analytic` ya existen en Express |
| Rutas WebSocket | Socket.io (ya en Express) con namespaces `/rt/inventory`, `/rt/analytic` y `/rt/gateway`; rutas lógicas `/ws/v1/rt/...` |
| Nginx | Sin cambios: `/api/v1/*` y `/socket.io/*` ya van a Express. `/rs/*` sigue reservado para Rust |
| Volver a Rust | Cambiar el prefijo `/rt` por `/rs`; nombres de módulo, entidades, archivos y rutas se conservan |
| Dependencia nueva | `@solana/web3.js` (Solana, sprint 9.2): **por aprobar**. Sin ella, 9.2 cubre solo EVM con `ethers` v6 |
| Latencias objetivo | Las mismas de Rust (menos de 1 a 50 ms según el módulo), a verificar con k6 en el sprint 10.2; Node.js no da las garantías de Rust bajo carga extrema |
| Ahorro de recursos | Corre dentro del contenedor Express (un contenedor y un job de CI menos); Map con tope y TTL; Redis con `volatile-lru` y 128 MB |

```
ecommerce-express/
└── src/module/                                          # Fase 9 · reemplazo temporal de Rust (sprints 9.1 a 9.3)
    │
    ├── realtime_inventory/                              # Real-time Inventory (sprint 9.1) — carpeta `inventory` en Rust
    │   ├── index.ts                                     # TS|Module|N-Lyr|-|export handler/service/store/model/dto/error (mod.rs)
    │   ├── handler/inventory.handler.ts                 # Express·Socket.io|Observer|N-Lyr|Async·POO|HTTP + stream /rt/inventory
    │   ├── service/inventory.service.ts                 # TS|Strategy|N-Lyr|Async·POO|Stock en memoria, reservas TTL, sync PG
    │   ├── store/dashmap.store.ts                       # Map nativa|Repository|N-Lyr|Func|Map<string, InventoryEntry> sin locks
    │   ├── model/inventory.model.ts                     # Prisma·PG|ActiveRecord|N-Lyr|POO|Tabla inventory
    │   ├── dto/inventory.dto.ts                         # Zod·TS|DTO|N-Lyr|Func|StockRequest, ReservationRequest, StockResponse
    │   └── error/inventory.error.ts                     # TS|Exception|N-Lyr|POO|InsufficientStock, NotFound
    │
    ├── realtime_analytic/                               # High-frequency Analytics (sprint 9.1)
    │   ├── index.ts                                     # TS|Module|N-Lyr|-|export handler/service/model/dto/error/util
    │   ├── handler/realtime_analytic.handler.ts         # Express·Socket.io|Observer|N-Lyr|Async·POO|HTTP + stream /rt/analytic
    │   ├── service/realtime_analytic.service.ts         # TS|Strategy|N-Lyr|Async·Reactivo|Agregación en ventanas deslizantes
    │   ├── model/realtime_analytic.model.ts             # Mongoose·Mongo|ActiveRecord|N-Lyr|POO|Eventos y métricas (TTL)
    │   ├── dto/realtime_analytic.dto.ts                 # Zod·TS|DTO|N-Lyr|Func|CreateEventRequest, MetricResponse
    │   ├── error/realtime_analytic.error.ts             # TS|Exception|N-Lyr|POO|AnalyticError
    │   └── util/window.util.ts                          # TS|Util|N-Lyr|Func|Windowing: tumbling, sliding, session
    │
    ├── blockchain/                                      # Blockchain Integration (sprint 9.2)
    │   ├── index.ts                                     # TS|Module|N-Lyr|-|export handler/service/model/dto/error/config
    │   ├── handler/blockchain.handler.ts                # Express|Adapter|N-Lyr|Async·POO|HTTP, params blockchain y delegación
    │   ├── service/blockchain.service.ts                # ethers v6|Adapter·Strategy·Factory|N-Lyr|Async·POO|Firma de tx y llamadas RPC
    │   ├── config/chain.config.ts                       # TS|Config|N-Lyr|Typed|ChainConfig { chainId, rpcUrl, explorerUrl }
    │   ├── model/blockchain.model.ts                    # Prisma·PG|ActiveRecord|N-Lyr|POO|Transacciones y contratos
    │   ├── dto/blockchain.dto.ts                        # Zod·TS|DTO|N-Lyr|Func|TransactionRequest, BalanceResponse, ContractCallRequest
    │   └── error/blockchain.error.ts                    # TS|Exception|N-Lyr|POO|RpcError, InsufficientGas, NonceConflict
    │
    ├── gateway/                                         # Payment Gateway Proxy (sprint 9.3)
    │   ├── index.ts                                     # TS|Module|N-Lyr|-|export handler/service/model/dto/error/guard/strategy
    │   ├── handler/gateway.handler.ts                   # Express|Proxy|N-Lyr|Async·POO|HTTP, circuit breaker y delegación
    │   ├── service/gateway.service.ts                   # axios·Stripe|Proxy·Adapter·Strategy|N-Lyr|Async·POO|Routing PSP, retry
    │   ├── model/gateway.model.ts                       # Prisma·PG|ActiveRecord|N-Lyr|POO|Transacciones gateway y reintentos
    │   ├── dto/gateway.dto.ts                           # Zod·TS|DTO|N-Lyr|Func|PaymentRequest, RetryRequest, PaymentResponse
    │   ├── error/gateway.error.ts                       # TS|Exception|N-Lyr|POO|CircuitOpen, Timeout, Unavailable
    │   ├── guard/circuit_breaker.guard.ts               # TS|Circuit Breaker|N-Lyr|Async·POO|CLOSED/OPEN/HALF_OPEN (sin librería)
    │   └── strategy/retry_policy.strategy.ts            # TS|Strategy·Retry|N-Lyr|Func|Backoff exponencial con Idempotency-Key
    │
    ├── websocket_gateway/                               # WebSocket Gateway (sprint 9.3)
    │   ├── handler/websocket_gateway.handler.ts         # Express·Socket.io|Observer|N-Lyr|Async·POO|Namespace /rt/gateway
    │   ├── service/websocket_gateway.service.ts         # TS|Pub/Sub|N-Lyr|Async·Reactivo|Lógica entre handler y repository
    │   ├── repository/websocket_gateway.repository.ts   # TS|Repository|N-Lyr|Func|Conexiones activas en memoria
    │   ├── model/websocket_gateway.model.ts             # TS strict|VO|N-Lyr|Typed|Interface de conexión
    │   └── util/pubsub.util.ts                          # Socket.io|Pub/Sub|N-Lyr|Reactivo|PubSub filtrado por topic (rooms)
    │
    └── cache/                                           # Cache Service (sprint 9.3)
        ├── index.ts                                     # TS|Module|N-Lyr|-|export handler/service/store/dto/error
        ├── handler/cache.handler.ts                     # Express|Cache-Aside|N-Lyr|Async·POO|HTTP, params y delegación
        ├── service/cache.service.ts                     # Redis·TS|Cache-Aside·Write-Through|N-Lyr|Async·POO|TTL, warmup, invalidación por patrón
        ├── store/dashmap.store.ts                       # Map nativa|Repository|N-Lyr|Func|L1 en memoria con tope y LRU (L2 en Redis)
        ├── dto/cache.dto.ts                             # Zod·TS|DTO|N-Lyr|Func|SetCacheRequest, GetCacheResponse, WarmupRequest
        └── error/cache.error.ts                         # TS|Exception|N-Lyr|POO|KeyNotFound, TtlExpired, PatternInvalid
```

| Módulo (sprint) | Archivos | Endpoints REST | Socket.io | Base de datos |
|-----------------|:--------:|:--------------:|:---------:|---------------|
| `realtime_inventory` (9.1) | 7 | 4 | 1 (`/rt/inventory`) | PostgreSQL + Map en memoria + Redis (reservas con TTL) |
| `realtime_analytic` (9.1) | 7 | 3 | 1 (`/rt/analytic`) | MongoDB (eventos con TTL, escritura por lotes) + Map en memoria |
| `blockchain` (9.2) | 7 | 4 | 0 | PostgreSQL + Redis (nonce y caché RPC de TTL corto) |
| `gateway` (9.3) | 8 | 4 | 0 | PostgreSQL + Redis (Idempotency-Key y estado del circuit breaker) |
| `websocket_gateway` (9.3) | 5 | 3 | 1 (`/rt/gateway`) | Sin base de datos; conexiones en memoria (Redis solo con varias réplicas) |
| `cache` (9.3) | 6 | 6 | 0 | Sin base de datos; Map en memoria (L1) + Redis (L2) |

El detalle de cada ruta está en la hoja `⚙️ Express TS` del Excel (filas 396 a 485) y en la sección C.13 del Word. Los títulos y conteos de este archivo (38 módulos) no se modificaron.

**Implementación Fase 9 (06/10/2026):** los 6 módulos están en `src/module/` con los archivos del árbol anterior (40 archivos) y montados en `app.ts` bajo `/api/v1/rt/{inventory,analytic,blockchain,gateway,ws,cache}`; los namespaces Socket.io `/rt/inventory`, `/rt/analytic` (solo ADMIN) y `/rt/gateway` (solo autenticados) se registran en `bootstrap.ts` sobre el mismo servidor. Pruebas: `test/unit/phase9.spec.ts`.

| Tema | Implementación |
|------|----------------|
| Base de datos | Migración `20261006000000_phase9_express_hpc`: tablas `blockchain_transactions`, `gateway_transactions` y `gateway_retry_attempts` (solo tablas nuevas). MongoDB: colección `rt_analytic_events` con índice TTL de 30 días. Inventario, WebSocket Gateway y caché no crean tablas |
| Inventario RT | Map en memoria (tope 20.000 variantes, TTL 15 s) sincronizado con `inventory.adjusted`; escrituras por el módulo `inventory` (misma guarda atómica y mismo historial). Reservas: `reservedStock` en PostgreSQL + Redis con TTL; el job de cada minuto libera las vencidas (ZREM decide quién libera: una sola vez). Header `Server-Timing` con la latencia interna |
| Analítica HF | Buffer ordenado de la última hora (tope 50.000 eventos), ventanas tumbling/sliding/session con búsqueda binaria, p50/p95/p99, escritura por lotes (5 s o 500 eventos). KPIs por Socket.io agrupados cada 100 ms solo si hubo actividad y hay administradores conectados |
| Blockchain | ethers v6 (sin dependencias nuevas): 7 cadenas EVM con RPC públicos gratuitos (`WEB3_RPC_URLS` los reemplaza), `staticNetwork` y sondeo cada 12 s; ABI mínimos ERC-20/ERC-721 (lista blanca de métodos); nonce en Redis; reintentos con el mismo nonce; cancelación por reemplazo (+25 % de gas). Escrituras solo ADMIN + `Idempotency-Key`. Solana sigue pendiente de aprobar `@solana/web3.js` |
| Proxy de pagos | Envuelve `paymentService` (no duplica Stripe): `Idempotency-Key` (UNIQUE en PostgreSQL), circuit breaker propio (5 fallos → OPEN 30 s, timeout 8 s), 1 reintento extra (el SDK de Stripe ya reintenta 2). El estado del circuito es por proceso (en memoria) |
| Caché L1/L2 | `DashMapStore` genérico (Map con TTL + LRU + tope de 5.000 entradas; lo reutiliza el inventario RT) + Redis con prefijo `rt:cache:`; anti-stampede; warmup `product`, `pricing`, `inventory` (`session` responde 0: las sesiones ya viven en Redis) |
| Variables nuevas | `WEB3_DEFAULT_CHAIN` (por defecto `sepolia`) y `WEB3_RPC_URLS` (`polygon=https://...,sepolia=https://...`), ambas opcionales |
| Verificado | `tsc --noEmit`, ESLint, Jest (13 pruebas) y prueba en vivo de los 6 módulos: lectura de stock desde memoria 0,36 ms (primera lectura desde PostgreSQL 95 ms) |
| Pendiente | GraphQL de estos módulos (la matriz lo lista; REST + Socket.io cubren los casos de uso), MCP para transacciones críticas, k6 (sprint 10.2) y reconciliación de transacciones blockchain que queden PENDING tras un reinicio |
