// inventory.model.ts (TypeScript + Prisma) => modelo del inventario en tiempo real (sprint 9.1).
// La tabla "inventory" de PostgreSQL es product_variants (columnas stock / "reservedStock"), que mapea el
// InventoryRepository del módulo inventory con Prisma ($queryRaw): fuente de verdad. Este módulo NO crea tablas:
// mantiene una copia caliente en un Map (InventoryEntry) y las reservas con TTL en Redis (StockReservation).
import type { StockLevel } from "../../inventory/model/inventory.model";

// InventoryEntry => Value Object inmutable guardado en el Map (lo mínimo para responder < 10 ms)
export interface InventoryEntry {
  readonly variantId: string;
  readonly sku: string;
  readonly stock: number; // Unidades físicas
  readonly reserved: number; // Apartadas (checkout + reservas de carrito)
  readonly available: number; // stock - reserved
  readonly syncedAt: string; // Última sincronización con PostgreSQL (ISO 8601)
}

// StockReservation => apartado temporal de unidades para un carrito (vive en Redis con TTL)
export interface StockReservation {
  readonly id: string;
  readonly productId: string; // ID de la VARIANTE (el stock es por variante; la matriz lo llama product_id)
  readonly cartId: string;
  readonly userId: string;
  readonly quantity: number;
  readonly expiresAt: string;
}

// toEntry => mapper puro StockLevel (fila Prisma) -> InventoryEntry (descarta nombres: no hacen falta en el Map)
export function toEntry(level: StockLevel, now = new Date()): InventoryEntry {
  return { variantId: level.variantId, sku: level.sku, stock: level.stock, reserved: level.reserved, available: level.available, syncedAt: now.toISOString() };
}

// RtInventoryKeys => claves Redis del módulo (prefijo "rt:inv:" para no chocar con otros módulos). "as const" => solo lectura
export const RtInventoryKeys = {
  reservation: (id: string) => `rt:inv:resv:${id}`,
  // Índice carrito+variante => idempotencia: reservar dos veces lo mismo devuelve la misma reserva
  cartIndex: (cartId: string, variantId: string) => `rt:inv:cart:${cartId}:${variantId}`,
  // ZSET ordenado por vencimiento (score = epoch ms). El miembro "id:variante:cantidad" basta para liberar el stock
  // aunque la clave de la reserva ya no exista (el barrido no depende de ella)
  expiry: "rt:inv:resv:expiry",
} as const;

// expiryMember / parseExpiryMember => (de)serialización del miembro del ZSET (funciones puras)
export const expiryMember = (reservation: Pick<StockReservation, "id" | "productId" | "quantity">) =>
  `${reservation.id}:${reservation.productId}:${reservation.quantity}`;

export function parseExpiryMember(member: string): { id: string; productId: string; quantity: number } | null {
  const [id, productId, quantity] = member.split(":"); // Desestructuración de arreglo
  const units = Number(quantity);
  return id && productId && Number.isInteger(units) && units > 0 ? { id, productId, quantity: units } : null;
}
