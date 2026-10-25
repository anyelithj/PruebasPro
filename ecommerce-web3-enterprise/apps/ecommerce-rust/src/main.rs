// main.rs (Rust + Axum + Tokio) => punto de entrada (bootstrap) del servicio de alto rendimiento.
// Paradigma: programación asíncrona + funcional (Result en vez de excepciones). Patrón: Composition Root —
// aquí se ensamblan router y middlewares; la lógica de negocio vive en src/module/* (handler -> service -> repository).

// "use" => importa elementos de otros crates/módulos al ámbito actual
use axum::{routing::get, Json, Router}; // Router HTTP de Axum, helper de rutas GET y extractor/respuesta JSON
use serde_json::{json, Value}; // Macro json! para construir JSON y el tipo dinámico Value
use std::net::SocketAddr; // Dirección IP + puerto (librería estándar de Rust)
use tower_http::trace::TraceLayer; // Middleware (patrón Decorator) que registra cada request/response con tracing

// "#[tokio::main]" => macro atributo que crea el runtime async de Tokio y ejecuta main dentro de él
// "async fn" => función asíncrona (devuelve un Future) | "-> Result<(), Box<dyn Error>>" => errores propagables con "?"
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // "let" => enlace inmutable por defecto | ".ok()" => ignora la ausencia de .env (en Docker las vars llegan por env_file)
    dotenvy::dotenv().ok();

    // Inicializa logs estructurados; nivel controlado por RUST_LOG (ej. RUST_LOG=info,tower_http=debug)
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    // "std::env::var" => lee variable de entorno | "unwrap_or_else" => valor por defecto si no existe (closure "|_|")
    // "parse::<u16>()" => convierte String a número de puerto; "?" propaga el error si el valor es inválido
    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse::<u16>()?;

    // Builder pattern: Router::new() encadena rutas y capas de forma inmutable (cada método devuelve un nuevo Router)
    let app = Router::new()
        .route("/health", get(health)) // Healthcheck usado por Docker/Kubernetes (liveness probe)
        .layer(TraceLayer::new_for_http()); // Aplica el middleware de tracing a todas las rutas

    // "0.0.0.0" => escucha en todas las interfaces (obligatorio dentro de un contenedor Docker)
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    // ".await" => suspende la tarea hasta que el Future termine, sin bloquear el hilo (I/O no bloqueante)
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("ecommerce-rust escuchando en {addr}"); // Macro de log con interpolación

    // axum::serve => acepta conexiones y despacha cada request al Router
    axum::serve(listener, app).await?;
    // "Ok(())" => valor de retorno exitoso con tipo unidad "()" (sin punto y coma: es la expresión final)
    Ok(())
}

// Handler: función async pura que Axum convierte en endpoint (patrón Controller mínimo)
// "Json<Value>" => Axum serializa el valor a JSON y pone Content-Type: application/json
async fn health() -> Json<Value> {
    Json(json!({ "status": "ok", "service": "ecommerce-rust" }))
}
