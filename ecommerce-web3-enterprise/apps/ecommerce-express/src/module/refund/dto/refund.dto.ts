// refund.dto.ts => contrato de salida del módulo Refund.
import type { RefundReason, RefundResolution, RefundStatus, ReturnStatus } from "@prisma/client";

export interface RefundDto {
  id: string;
  orderId: string;
  orderNumber: string;
  userId: string;
  reason: RefundReason;
  description: string;
  evidenceUrls: string[];
  amountCents: number;
  currency: string;
  status: RefundStatus;
  reviewNote: string | null;
  processedAt: Date | null;
  createdAt: Date;
  resolution: RefundResolution; // RF-12.4
  exchangeVariantId: string | null;
  exchangeOrderId: string | null;
  storeCreditCode: string | null;
  returnStatus: ReturnStatus | null; // RF-12.2 / 12.8
  returnCarrier: string | null;
  returnTrackingNumber: string | null;
  pickupScheduledAt: Date | null;
  receivedAt: Date | null;
  inspection: { passed: boolean; notes: string; photoUrls: string[]; inspectedAt: string } | null; // RF-12.7
}

// RefundStatsDto => RF-12.9 estadísticas de devoluciones del período
export interface RefundStatsDto {
  total: number;
  byStatus: Record<string, number>;
  byReason: Array<{ reason: string; count: number }>; // Ordenadas de mayor a menor: razones más frecuentes
  byResolution: Record<string, number>;
  refundedCents: number;
  returnRate: number; // Devoluciones / pedidos entregados del período (0-1)
  avgResolutionHours: number | null; // Solicitud -> procesada
}
