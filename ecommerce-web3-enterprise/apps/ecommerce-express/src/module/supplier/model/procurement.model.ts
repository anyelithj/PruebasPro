// procurement.model.ts (TypeScript puro) => reglas de negocio de compras a proveedores, SIN base de datos (testeables):
//  - RF-23.6 número legible de la orden de compra y transiciones válidas de estado (patrón State)
//  - RF-23.5 ranking de proveedores: puntualidad, calidad recibida, evaluación y precio relativo
//  - RF-23.3 valorización del inventario por costo promedio ponderado y por FIFO
//  - RF-23.8 estado de una cuenta por pagar (al día, por vencer, vencida)
// Paradigma: funcional (funciones puras, datos inmutables). Patrones: State (TRANSITIONS) + Strategy (método de valoración).
import type { PurchaseOrderStatus } from "@prisma/client";

// TRANSITIONS => estados a los que puede pasar cada estado (una orden recibida o anulada ya no cambia)
export const PO_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["PARTIAL", "RECEIVED", "CANCELLED"],
  PARTIAL: ["PARTIAL", "RECEIVED"],
  RECEIVED: [],
  CANCELLED: [],
};
export const canTransition = (from: PurchaseOrderStatus, to: PurchaseOrderStatus) => PO_TRANSITIONS[from].includes(to);

// poNumber => "OC-2026-000123" a partir del consecutivo (padStart: siempre 6 dígitos)
export const poNumber = (year: number, sequence: number) => `OC-${year}-${String(sequence).padStart(6, "0")}`;

// ---------- RF-23.5 ranking ----------
export interface SupplierStats {
  supplierId: string;
  orders: number; // Órdenes recibidas evaluables
  onTime: number; // Recibidas en o antes de la fecha esperada
  received: number; // Unidades aceptadas por calidad
  rejected: number; // Unidades rechazadas por calidad
  rating: number | null; // Evaluación manual 0..5
  priceIndex: number | null; // Costo promedio frente al promedio del mercado de los mismos SKU (1 = igual, <1 = más barato)
}
// WEIGHTS => peso de cada criterio en el puntaje (suman 1): puntualidad y calidad pesan más que el precio
const WEIGHTS = { onTime: 0.35, quality: 0.35, rating: 0.15, price: 0.15 } as const;

// supplierScore => puntaje 0..100. Sin datos de un criterio se usa un valor neutro (no premia ni castiga)
export function supplierScore(stats: SupplierStats): number {
  const onTime = stats.orders ? stats.onTime / stats.orders : 0.5;
  const units = stats.received + stats.rejected;
  const quality = units ? stats.received / units : 0.5;
  const rating = stats.rating !== null ? stats.rating / 5 : 0.5;
  // Precio: 1 = mercado => 0.5; 20 % más barato => 1; 20 % más caro => 0 (recortado a [0, 1])
  const price = stats.priceIndex !== null ? Math.min(1, Math.max(0, 0.5 + (1 - stats.priceIndex) * 2.5)) : 0.5;
  return Math.round((onTime * WEIGHTS.onTime + quality * WEIGHTS.quality + rating * WEIGHTS.rating + price * WEIGHTS.price) * 100);
}

// ---------- RF-23.3 valorización ----------
export interface CostLayer {
  quantity: number;
  unitCostCents: number;
  createdAt: Date;
}
export interface Valuation {
  valueCents: number;
  unitCostCents: number; // Costo unitario resultante
  unvaluedUnits: number; // Unidades sin costo conocido (entraron antes de registrar compras)
}

// averageValuation => costo promedio ponderado de todas las entradas x stock actual
export function averageValuation(layers: CostLayer[], stock: number): Valuation {
  const units = layers.reduce((sum, layer) => sum + layer.quantity, 0);
  if (units === 0) return { valueCents: 0, unitCostCents: 0, unvaluedUnits: stock };
  const average = layers.reduce((sum, layer) => sum + layer.quantity * layer.unitCostCents, 0) / units;
  return { valueCents: Math.round(average * stock), unitCostCents: Math.round(average), unvaluedUnits: 0 };
}

// fifoValuation => lo primero que entró es lo primero que salió: el stock actual son las capas MÁS RECIENTES
export function fifoValuation(layers: CostLayer[], stock: number): Valuation {
  let pending = stock;
  let value = 0;
  for (const layer of [...layers].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
    if (pending <= 0) break;
    const take = Math.min(pending, layer.quantity);
    value += take * layer.unitCostCents;
    pending -= take;
  }
  const valued = stock - pending;
  return { valueCents: value, unitCostCents: valued ? Math.round(value / valued) : 0, unvaluedUnits: Math.max(0, pending) };
}

// ---------- RF-23.8 cuentas por pagar ----------
export type PayableState = "PAID" | "OVERDUE" | "DUE_SOON" | "OPEN";
export const DUE_SOON_DAYS = 5; // Alerta con 5 días de anticipación

export function payableState(dueAt: Date | null, paidAt: Date | null, now = new Date()): PayableState {
  if (paidAt) return "PAID";
  if (!dueAt) return "OPEN";
  const days = (dueAt.getTime() - now.getTime()) / 86_400_000;
  return days < 0 ? "OVERDUE" : days <= DUE_SOON_DAYS ? "DUE_SOON" : "OPEN";
}
