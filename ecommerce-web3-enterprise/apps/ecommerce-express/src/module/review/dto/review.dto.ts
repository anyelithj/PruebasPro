// review.dto.ts => contratos de salida del módulo Review (ReviewList, ReviewSummary, StarRating).
import type { ReviewStatus } from "@prisma/client";

export interface ReviewDto {
  id: string;
  productId: string;
  productName: string;
  author: { id: string; name: string; avatarUrl: string | null }; // Nombre abreviado ("Ana M.") por privacidad
  rating: number;
  title: string;
  body: string;
  status: ReviewStatus;
  sentimentScore: number;
  isVerifiedPurchase: boolean;
  vendorReply: string | null;
  vendorRepliedAt: Date | null;
  editableUntil: Date;
  createdAt: Date;
  updatedAt: Date;
  photoUrls: string[]; // RF-15.2
  aspects: Partial<Record<"quality" | "accuracy" | "fit" | "value", number>> | null;
  helpfulCount: number; // RF-15.3
  sentimentLabel: string | null; // RF-15.10
  emotions: Record<string, number> | null;
  edited: boolean; // RF-15.6 tiene historial de cambios
}

// ReviewRevisionDto => RF-15.6 versión anterior de una reseña
export interface ReviewRevisionDto {
  rating: number;
  title: string;
  body: string;
  editedAt: Date;
}

// ReviewSummaryDto => promedio + distribución por estrellas (barras del ReviewSummary)
export interface ReviewSummaryDto {
  productId: string;
  average: number;
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  aspects: Partial<Record<"quality" | "accuracy" | "fit" | "value", number>>; // RF-15.2 promedio por aspecto
  photoCount: number; // RF-15.3 fotos en la galería
}
