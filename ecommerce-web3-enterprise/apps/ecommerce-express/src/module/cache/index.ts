// index.ts => punto de entrada del módulo Cache Service (equivale a mod.rs en Rust): expone su API pública.
// Patrón Facade/Barrel: app.ts y otros módulos importan desde aquí sin conocer la estructura interna.
export { cacheRouter } from "./handler/cache.handler";
export { cacheService, CacheService } from "./service/cache.service";
export { DashMapStore } from "./store/dashmap.store";
export * from "./dto/cache.dto";
export { CacheError } from "./error/cache.error";
