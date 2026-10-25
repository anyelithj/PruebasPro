// recommendation.schema.ts => validación Zod del módulo Recommendation.
import { z } from "zod";
import { PaginationQuerySchema } from "../../../shared/util/pagination.util";

// Lista acotada de UUIDs: límite de 20 semillas => consultas SQL pequeñas (rendimiento y ahorro de CPU)
const IdList = z.array(z.string().uuid()).max(20).default([]);

// SessionContextSchema => POST /api/v1/recommendation/session ("iniciar sesión de personalización con contexto")
export const SessionContextSchema = z.object({
  viewedProductIds: IdList,
  cartProductIds: IdList,
  categoryIds: IdList,
  limit: z.number().int().min(1).max(24).default(8),
});

export const ListRecommendationsQuerySchema = PaginationQuerySchema;

export type SessionContextInput = z.infer<typeof SessionContextSchema>;

// HomeQuerySchema => GET /api/v1/recommendation/home (RF-18.7): hora local, dispositivo y ciudad opcional
export const HomeQuerySchema = z.object({
  hour: z.coerce.number().int().min(0).max(23).default(12),
  device: z.enum(["mobile", "tablet", "desktop"]).default("desktop"),
  city: z.string().trim().max(80).optional(),
});
