// supplier.model.ts => entidad de dominio Supplier (tabla "suppliers" de PostgreSQL, Prisma).
// "type X = Prisma..." => el tipo sale del cliente generado: si cambia schema.prisma, el compilador avisa (DRY).
import type { Supplier as SupplierRow } from "@prisma/client";

export type Supplier = SupplierRow;

const DAY_MS = 24 * 60 * 60 * 1000;
export const CONTRACT_ALERT_DAYS = 30; // Ventana de alerta de renovación de contrato

// contractDaysLeft => días hasta el fin del contrato (negativo = vencido; null = sin fecha). Función pura.
export function contractDaysLeft(contractEndsAt: Date | null, now = new Date()): number | null {
  return contractEndsAt ? Math.ceil((contractEndsAt.getTime() - now.getTime()) / DAY_MS) : null;
}
