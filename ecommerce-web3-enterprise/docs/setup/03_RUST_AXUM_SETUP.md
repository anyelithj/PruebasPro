# 🦀 Backend Rust Axum — Guía de Creación desde Cero (Git Bash)

> Proyecto: **ecommerce-rust** · Basado en `03_RUST_AXUM.md`, `ecommerce_matriz_trazabilidad_v34.xlsx` (hoja "🦀 Rust Axum") y `ESPECIFICACION_TECNICA_UNIFICADA.md`.

⚠️ **Nota importante:** Rust usa **Cargo**, no pnpm (pnpm es exclusivo del ecosistema Node/JavaScript). Este archivo usa `cargo add`, ejecutado desde Git Bash.

---

## 0. Prerrequisitos (Git Bash)

```bash
rustc --version
cargo --version   # si no está instalado: ver https://rustup.rs
docker -v         # PostgreSQL con pgvector
```

---

## 1. Crear el proyecto desde cero

```bash
cargo new ecommerce-rust --bin
cd ecommerce-rust
```

---

## 2. Instalar dependencias (cargo add)

Agrupadas exactamente por lo que exige la matriz (6 módulos de alto rendimiento). Sin duplicados de propósito.

### 2.1 Runtime async y framework web

```bash
cargo add tokio --features full
cargo add axum
cargo add tower tower-http --features tower-http/full
```

### 2.2 Serialización

```bash
cargo add serde --features derive
cargo add serde_json
```

### 2.3 Base de datos — SeaORM (PostgreSQL)

```bash
cargo add sea-orm --features sqlx-postgres,runtime-tokio-native-tls,macros
cargo add sea-orm-migration
```

### 2.4 GraphQL

```bash
cargo add async-graphql
cargo add async-graphql-axum
```

### 2.5 Cache en memoria (lock-free, catálogo/carrito de alta concurrencia)

```bash
cargo add dashmap
```

### 2.6 WebSocket (precios/inventario en tiempo real)

```bash
cargo add tokio-tungstenite
```

### 2.7 Cliente HTTP (llamadas salientes a otros microservicios)

```bash
cargo add reqwest --features json
```

### 2.8 Web3 / Blockchain

```bash
cargo add ethers
```

> 🔄 **Crate `web3` eliminado (v35):** hace lo mismo que `ethers` (proveedores RPC, ABI, contratos ERC-20/ERC-721) y la especificación `03_RUST_AXUM.md` solo nombra **ethers-rs**. Misma decisión que en Express: una sola librería Web3 (`ethers`). Solana-SDK se agrega en la Fase 9 junto con el módulo que lo usa.

### 2.9 Logging

```bash
cargo add tracing tracing-subscriber
```

### 2.10 Variables de entorno

```bash
cargo add dotenvy
```

> `Solana-SDK` y `pgvector` figuran en la tabla general del stack pero **no aparecen en ningún módulo concreto de la matriz**; no se instalan por defecto para no agregar dependencias no implementadas. Si vas a usarlos, dímelo y agrego `cargo add solana-sdk` / la extensión `pgvector` en PostgreSQL.

---

## 3. Crear la estructura completa de carpetas y archivos

> Generado automáticamente a partir del árbol exacto de `03_RUST_AXUM.md` (6 módulos HPC). Ejecutar dentro de la carpeta padre que contiene `ecommerce-rust/`.

```bash
mkdir -p \
  "ecommerce-rust/src" \
  "ecommerce-rust/src/module" \
  "ecommerce-rust/src/module/inventory" \
  "ecommerce-rust/src/module/inventory/handler" \
  "ecommerce-rust/src/module/inventory/service" \
  "ecommerce-rust/src/module/inventory/repository" \
  "ecommerce-rust/src/module/inventory/model" \
  "ecommerce-rust/src/module/inventory/schema" \
  "ecommerce-rust/src/module/inventory/route" \
  "ecommerce-rust/src/module/inventory/stream" \
  "ecommerce-rust/src/module/inventory/error" \
  "ecommerce-rust/src/module/analytics" \
  "ecommerce-rust/src/module/analytics/handler" \
  "ecommerce-rust/src/module/analytics/service" \
  "ecommerce-rust/src/module/analytics/repository" \
  "ecommerce-rust/src/module/analytics/model" \
  "ecommerce-rust/src/module/analytics/schema" \
  "ecommerce-rust/src/module/analytics/route" \
  "ecommerce-rust/src/module/analytics/stream" \
  "ecommerce-rust/src/module/analytics/error" \
  "ecommerce-rust/src/module/blockchain" \
  "ecommerce-rust/src/module/blockchain/handler" \
  "ecommerce-rust/src/module/blockchain/service" \
  "ecommerce-rust/src/module/blockchain/repository" \
  "ecommerce-rust/src/module/blockchain/model" \
  "ecommerce-rust/src/module/blockchain/schema" \
  "ecommerce-rust/src/module/blockchain/route" \
  "ecommerce-rust/src/module/blockchain/contract" \
  "ecommerce-rust/src/module/blockchain/error" \
  "ecommerce-rust/src/module/payment_gateway" \
  "ecommerce-rust/src/module/payment_gateway/handler" \
  "ecommerce-rust/src/module/payment_gateway/service" \
  "ecommerce-rust/src/module/payment_gateway/repository" \
  "ecommerce-rust/src/module/payment_gateway/model" \
  "ecommerce-rust/src/module/payment_gateway/schema" \
  "ecommerce-rust/src/module/payment_gateway/route" \
  "ecommerce-rust/src/module/payment_gateway/proxy" \
  "ecommerce-rust/src/module/payment_gateway/error" \
  "ecommerce-rust/src/module/websocket_gateway" \
  "ecommerce-rust/src/module/websocket_gateway/handler" \
  "ecommerce-rust/src/module/websocket_gateway/service" \
  "ecommerce-rust/src/module/websocket_gateway/repository" \
  "ecommerce-rust/src/module/websocket_gateway/model" \
  "ecommerce-rust/src/module/websocket_gateway/schema" \
  "ecommerce-rust/src/module/websocket_gateway/route" \
  "ecommerce-rust/src/module/websocket_gateway/hub" \
  "ecommerce-rust/src/module/websocket_gateway/error" \
  "ecommerce-rust/src/module/cache" \
  "ecommerce-rust/src/module/cache/handler" \
  "ecommerce-rust/src/module/cache/service" \
  "ecommerce-rust/src/module/cache/repository" \
  "ecommerce-rust/src/module/cache/model" \
  "ecommerce-rust/src/module/cache/schema" \
  "ecommerce-rust/src/module/cache/route" \
  "ecommerce-rust/src/module/cache/store" \
  "ecommerce-rust/src/module/cache/error" \
  "ecommerce-rust/src/shared" \
  "ecommerce-rust/src/shared/middleware" \
  "ecommerce-rust/src/shared/util" \
  "ecommerce-rust/src/shared/types" \
  "ecommerce-rust/src/shared/error" \
  "ecommerce-rust/src/config" \
  "ecommerce-rust/migrations" \
  "ecommerce-rust/tests" \
  "ecommerce-rust/tests/unit" \
  "ecommerce-rust/tests/integration" \
  "ecommerce-rust/tests/bench" \
  "ecommerce-rust"

touch \
  "ecommerce-rust/src/module/inventory/handler/inventory_handler.rs" \
  "ecommerce-rust/src/module/inventory/service/inventory_service.rs" \
  "ecommerce-rust/src/module/inventory/repository/inventory_repository.rs" \
  "ecommerce-rust/src/module/inventory/model/inventory_model.rs" \
  "ecommerce-rust/src/module/inventory/schema/inventory_schema.rs" \
  "ecommerce-rust/src/module/inventory/route/inventory_route.rs" \
  "ecommerce-rust/src/module/inventory/stream/inventory_stream.rs" \
  "ecommerce-rust/src/module/inventory/stream/stock_broadcaster.rs" \
  "ecommerce-rust/src/module/inventory/error/inventory_error.rs" \
  "ecommerce-rust/src/module/analytics/handler/analytics_handler.rs" \
  "ecommerce-rust/src/module/analytics/service/analytics_service.rs" \
  "ecommerce-rust/src/module/analytics/repository/analytics_repository.rs" \
  "ecommerce-rust/src/module/analytics/model/analytics_model.rs" \
  "ecommerce-rust/src/module/analytics/schema/analytics_schema.rs" \
  "ecommerce-rust/src/module/analytics/route/analytics_route.rs" \
  "ecommerce-rust/src/module/analytics/stream/metrics_stream.rs" \
  "ecommerce-rust/src/module/analytics/stream/event_buffer.rs" \
  "ecommerce-rust/src/module/analytics/stream/aggregator.rs" \
  "ecommerce-rust/src/module/analytics/error/analytics_error.rs" \
  "ecommerce-rust/src/module/blockchain/handler/blockchain_handler.rs" \
  "ecommerce-rust/src/module/blockchain/service/blockchain_service.rs" \
  "ecommerce-rust/src/module/blockchain/repository/blockchain_repository.rs" \
  "ecommerce-rust/src/module/blockchain/model/blockchain_model.rs" \
  "ecommerce-rust/src/module/blockchain/schema/blockchain_schema.rs" \
  "ecommerce-rust/src/module/blockchain/route/blockchain_route.rs" \
  "ecommerce-rust/src/module/blockchain/contract/erc20_contract.rs" \
  "ecommerce-rust/src/module/blockchain/contract/nft_contract.rs" \
  "ecommerce-rust/src/module/blockchain/contract/solana_program.rs" \
  "ecommerce-rust/src/module/blockchain/error/blockchain_error.rs" \
  "ecommerce-rust/src/module/payment_gateway/handler/gateway_handler.rs" \
  "ecommerce-rust/src/module/payment_gateway/service/gateway_service.rs" \
  "ecommerce-rust/src/module/payment_gateway/repository/gateway_repository.rs" \
  "ecommerce-rust/src/module/payment_gateway/model/gateway_model.rs" \
  "ecommerce-rust/src/module/payment_gateway/schema/gateway_schema.rs" \
  "ecommerce-rust/src/module/payment_gateway/route/gateway_route.rs" \
  "ecommerce-rust/src/module/payment_gateway/proxy/stripe_proxy.rs" \
  "ecommerce-rust/src/module/payment_gateway/proxy/paypal_proxy.rs" \
  "ecommerce-rust/src/module/payment_gateway/proxy/circuit_breaker.rs" \
  "ecommerce-rust/src/module/payment_gateway/error/gateway_error.rs" \
  "ecommerce-rust/src/module/websocket_gateway/handler/ws_handler.rs" \
  "ecommerce-rust/src/module/websocket_gateway/service/ws_service.rs" \
  "ecommerce-rust/src/module/websocket_gateway/repository/ws_repository.rs" \
  "ecommerce-rust/src/module/websocket_gateway/model/ws_model.rs" \
  "ecommerce-rust/src/module/websocket_gateway/schema/ws_schema.rs" \
  "ecommerce-rust/src/module/websocket_gateway/route/ws_route.rs" \
  "ecommerce-rust/src/module/websocket_gateway/hub/connection_hub.rs" \
  "ecommerce-rust/src/module/websocket_gateway/hub/room_manager.rs" \
  "ecommerce-rust/src/module/websocket_gateway/hub/message_router.rs" \
  "ecommerce-rust/src/module/websocket_gateway/error/ws_error.rs" \
  "ecommerce-rust/src/module/cache/handler/cache_handler.rs" \
  "ecommerce-rust/src/module/cache/service/cache_service.rs" \
  "ecommerce-rust/src/module/cache/repository/cache_repository.rs" \
  "ecommerce-rust/src/module/cache/model/cache_model.rs" \
  "ecommerce-rust/src/module/cache/schema/cache_schema.rs" \
  "ecommerce-rust/src/module/cache/route/cache_route.rs" \
  "ecommerce-rust/src/module/cache/store/dashmap_store.rs" \
  "ecommerce-rust/src/module/cache/store/redis_store.rs" \
  "ecommerce-rust/src/module/cache/store/lru_eviction.rs" \
  "ecommerce-rust/src/module/cache/store/warmup_worker.rs" \
  "ecommerce-rust/src/module/cache/error/cache_error.rs" \
  "ecommerce-rust/src/shared/middleware/auth_middleware.rs" \
  "ecommerce-rust/src/shared/middleware/rate_limit_middleware.rs" \
  "ecommerce-rust/src/shared/middleware/tracing_middleware.rs" \
  "ecommerce-rust/src/shared/middleware/cors_middleware.rs" \
  "ecommerce-rust/src/shared/util/pagination.rs" \
  "ecommerce-rust/src/shared/util/crypto.rs" \
  "ecommerce-rust/src/shared/util/metrics.rs" \
  "ecommerce-rust/src/shared/types/common.rs" \
  "ecommerce-rust/src/shared/types/api_response.rs" \
  "ecommerce-rust/src/shared/types/pagination.rs" \
  "ecommerce-rust/src/shared/error/app_error.rs" \
  "ecommerce-rust/src/config/app_config.rs" \
  "ecommerce-rust/src/config/database_config.rs" \
  "ecommerce-rust/src/config/redis_config.rs" \
  "ecommerce-rust/src/config/tracing_config.rs" \
  "ecommerce-rust/src/main.rs" \
  "ecommerce-rust/src/lib.rs" \
  "ecommerce-rust/.env" \
  "ecommerce-rust/Cargo.toml" \
  "ecommerce-rust/Cargo.lock" \
  "ecommerce-rust/Dockerfile"
```

---

## 4. Compilar y ejecutar

```bash
cargo build
cargo run
```
