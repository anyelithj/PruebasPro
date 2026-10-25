# Dockerfile (Docker + Rust/Cargo) => multi-stage build. Contexto: raíz del monorepo
#   docker build -f apps/ecommerce-rust/Dockerfile --target production -t ecommerce-rust .
# Patrón Builder (multi-stage): compila con el toolchain completo y entrega solo el binario (imagen final ~100 MB vs ~2 GB)

# ---------- STAGE BASE: toolchain de Rust + librerías nativas ----------
# "FROM ... AS" => imagen base con nombre de stage reutilizable
FROM rust:1-slim-bookworm AS base
# "RUN" => ejecuta un comando en build | pkg-config + libssl-dev => requeridos por native-tls (sea-orm, reqwest)
RUN apt-get update && apt-get install -y --no-install-recommends pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
# "WORKDIR" => carpeta de trabajo dentro del contenedor
WORKDIR /app

# ---------- STAGE DEPS: compila SOLO las dependencias (capa cacheada mientras Cargo.toml no cambie) ----------
FROM base AS deps
# "COPY" => copia desde el contexto | "Cargo.lock*" => opcional hasta que se genere con "cargo build"
COPY apps/ecommerce-rust/Cargo.toml apps/ecommerce-rust/Cargo.lock* ./
# main.rs ficticio: permite compilar las crates externas sin el código real (truco estándar de cache de capas)
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release && rm -rf src

# ---------- STAGE DEVELOPMENT: usado por docker-compose.dev.yml (target: development) ----------
FROM deps AS development
COPY apps/ecommerce-rust ./
EXPOSE 8080
# "CMD" => comando por defecto del contenedor | "cargo run" recompila solo el código propio (deps ya cacheadas)
CMD ["cargo", "run"]

# ---------- STAGE BUILD: binario optimizado (profile.release de Cargo.toml) ----------
FROM deps AS build
COPY apps/ecommerce-rust ./
# "touch" => fuerza a Cargo a recompilar main.rs real (el ficticio tenía fecha más nueva)
RUN touch src/main.rs && cargo build --release

# ---------- STAGE PRODUCTION: imagen mínima sin compilador ----------
FROM debian:bookworm-slim AS production
# ca-certificates => HTTPS saliente (reqwest, RPC blockchain) | libssl3 => runtime de native-tls
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*
# "useradd" => usuario sin privilegios (principio de mínimo privilegio, seguridad)
RUN useradd --system --uid 10001 app
WORKDIR /app
# "--from=build" => copia SOLO el binario desde el stage de compilación
COPY --from=build /app/target/release/ecommerce-rust /usr/local/bin/ecommerce-rust
# "USER" => ejecuta el proceso como el usuario sin privilegios
USER app
EXPOSE 8080
CMD ["ecommerce-rust"]
