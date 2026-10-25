// shipping.exception.ts => errores de dominio del módulo Shipping.
import type { ShipmentStatus } from "@prisma/client";
import { ConflictException, NotFoundException, UnprocessableException } from "../../../shared/filter/http-exception.filter";

export class ShipmentNotFoundException extends NotFoundException {
  constructor(id: string) {
    super("Shipment", id);
  }
}

export class InvalidShipmentTransitionException extends ConflictException {
  constructor(from: ShipmentStatus, to: ShipmentStatus) {
    super(`No se puede pasar el envío de ${from} a ${to}`, "INVALID_SHIPMENT_TRANSITION", { from, to });
  }
}

export class NoShippingRatesException extends UnprocessableException {
  constructor() {
    super("No hay tarifas de envío disponibles para ese destino", "NO_SHIPPING_RATES");
  }
}
