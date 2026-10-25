//! lib.rs (Rust) => raíz de la librería del crate: expone src/module/*, src/shared/* y src/config/* a main.rs y a tests/.
//! "//!" => comentario de documentación del módulo contenedor (aparece en `cargo doc`).
//! Los módulos se declaran con `pub mod <nombre>;` a medida que se implementan (cada carpeta necesitará su mod.rs),
//! así Cargo no compila archivos vacíos. Arquitectura por módulo: handler -> service -> repository (N-Layer, SRP, DIP).
