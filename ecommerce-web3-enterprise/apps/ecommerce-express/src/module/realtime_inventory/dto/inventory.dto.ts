// inventory.dto.ts (Zod + TypeScript) => contratos del inventario en tiempo real: StockRequest, ReservationRequest,
// StockResponse. Patrón DTO: el schema valida en runtime y "z.infer" deriva el tipo (una sola fuente: DRY).
import { z } from "zod";
import type { InventoryEntry } from "../model/inventory.model";

// StockRequest => PUT /api/v1/rt/inventory/:id/stock (reemplazo total del stock; queda como movimiento ADJUSTMENT)
export const StockRequestSchema = z.object({
  stock: z.coerce.number().int().min(0).max(1_000_000),
  reason: z.string().trim().min(3).max(200).default("Ajuste en tiempo real"),
});
export type StockRequest = z.infer<typeof StockRequestSchema>;

// ReservationRequest => POST /api/v1/rt/inventory/reservation — body de la matriz en snake_case
export const ReservationRequestSchema = z.object({
  product_id: z.string().uuid(), // ID de la variante
  quantity: z.coerce.number().int().min(1).max(100),
  cart_id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/), // Sin ":" => no rompe las claves Redis
  ttl_seconds: z.coerce.number().int().min(30).max(3_600).default(900), // 15 min por defecto (carrito abandonado)
});
export type ReservationRequest = z.infer<typeof ReservationRequestSchema>;

// SubscribeSchema => evento Socket.io "inventory:subscribe" (máx. 50 variantes por conexión: tope de memoria)
export const SubscribeSchema = z.array(z.string().uuid()).min(1).max(50);

// StockResponse => entrada del Map + origen de la lectura (memory = Map < 10 ms; database = PostgreSQL)
export interface StockResponse extends InventoryEntry {
  readonly low: boolean;
  readonly source: "memory" | "database";
}

// toStockResponse => mapper puro (umbral de stock bajo inyectado: lo decide el service)
export function toStockResponse(entry: InventoryEntry, source: StockResponse["source"], threshold: number): StockResponse {
  return { ...entry, low: entry.available <= threshold, source };
}
