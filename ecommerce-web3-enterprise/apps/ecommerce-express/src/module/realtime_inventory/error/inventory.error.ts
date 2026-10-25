// inventory.error.ts (TypeScript) => errores de dominio del inventario en tiempo real (InsufficientStock, NotFound...).
// Patrón Factory Method sobre DomainException; el error.middleware los traduce a JSON { success, message, code }.
import { DomainException } from "../../../shared/filter/http-exception.filter";

export class InventoryError extends DomainException {
  public static insufficientStock(available: number): InventoryError {
    return new InventoryError(422, "INSUFFICIENT_STOCK", "Stock insuficiente para la reserva", { available });
  }

  public static notFound(variantId: string): InventoryError {
    return new InventoryError(404, "INVENTORY_NOT_FOUND", `Variante ${variantId} no encontrada`);
  }

  public static reservationNotFound(id: string): InventoryError {
    return new InventoryError(404, "RESERVATION_NOT_FOUND", `Reserva ${id} no encontrada o ya liberada`);
  }

  // reservationInProgress => dos peticiones simultáneas para el mismo carrito+variante (la otra aún no termina)
  public static reservationInProgress(): InventoryError {
    return new InventoryError(409, "RESERVATION_IN_PROGRESS", "Ya hay una reserva en curso para este carrito y variante");
  }

  // unavailable => sin Redis no se reserva: una reserva sin TTL dejaría stock apartado para siempre
  public static unavailable(): InventoryError {
    return new InventoryError(503, "RESERVATIONS_UNAVAILABLE", "Las reservas en tiempo real no están disponibles");
  }
}
