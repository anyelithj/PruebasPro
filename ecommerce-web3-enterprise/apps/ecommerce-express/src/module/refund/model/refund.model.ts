// refund.model.ts => reglas de negocio de devoluciones (funciones puras).
import type { OrderStatus, RefundStatus } from "@prisma/client";

export const RETURN_WINDOW_DAYS = 30; // Valor por defecto; el ADMIN lo configura en la sección "returns" (RF-12.6)

// canRequestRefund => solo pedidos entregados y dentro de la ventana de devolución configurada
export function canRequestRefund(order: { status: OrderStatus; deliveredAt: Date | null }, now: Date = new Date(), windowDays = RETURN_WINDOW_DAYS): boolean {
  if (order.status !== "DELIVERED" || !order.deliveredAt) return false;
  const deadline = new Date(order.deliveredAt.getTime() + windowDays * 24 * 60 * 60 * 1000);
  return now <= deadline;
}

// nextBusinessDay => RF-12.8 fecha de recolección: siguiente día hábil (lunes a viernes) a las 9:00 hora Colombia
export function nextBusinessDay(from: Date): Date {
  const date = new Date(from);
  do date.setUTCDate(date.getUTCDate() + 1);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6); // 0 domingo, 6 sábado
  date.setUTCHours(14, 0, 0, 0); // 14:00 UTC = 9:00 en Colombia (UTC-5)
  return date;
}

// NEEDS_PICKUP => motivos con producto físico por recoger (si no llegó, no hay nada que devolver)
export const needsPickup = (reason: string): boolean => reason !== "NOT_RECEIVED";

// Solo las solicitudes pendientes se pueden cancelar (cliente) o revisar (staff)
export const isPending = (status: RefundStatus): boolean => status === "REQUESTED";
