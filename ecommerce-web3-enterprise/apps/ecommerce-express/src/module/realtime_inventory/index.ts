// index.ts => punto de entrada del módulo Real-time Inventory (equivale a mod.rs en Rust).
// Patrón Facade/Barrel: exporta handler, service, store, model, dto y error sin exponer detalles internos.
export { realtimeInventoryRouter, registerRealtimeInventoryGateway } from "./handler/inventory.handler";
export { realtimeInventoryService, RealtimeInventoryService } from "./service/inventory.service";
export { InventoryStore } from "./store/dashmap.store";
export type { InventoryEntry, StockReservation } from "./model/inventory.model";
export * from "./dto/inventory.dto";
export { InventoryError } from "./error/inventory.error";
