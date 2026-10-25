// brand.schema.ts => validación Zod del módulo Brand.
import { z } from "zod";
import { PaginationQuerySchema } from "../../../shared/util/pagination.util";
import { queryBoolean } from "../../../shared/pipe/transform.pipe";

// CreateBrandSchema => POST /api/v1/brand ("registrar nueva marca con datos y logo")
// El logo se sube antes con POST /api/v1/media/upload (folder=brands) y aquí se envían url + publicId
export const CreateBrandSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().trim().max(1000).optional(),
  website: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
  logoPublicId: z.string().optional(),
  story: z.string().trim().max(5000).optional(), // RF-05.1 historia de la marca
  // RF-05.1 país de origen ISO 3166-1 alfa-2 ("CO"); ".toUpperCase()" normaliza "co" -> "CO"
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, { message: "País: código ISO de 2 letras (CO, US...)" }).optional(),
  isPremium: z.boolean().default(false), // RF-05.3 marca destacada
  isExclusive: z.boolean().default(false), // RF-05.3 marca exclusiva (insignia)
  isActive: z.boolean().default(true),
});

// UpdateBrandSchema => PATCH parcial ("actualizar información y/o logo")
export const UpdateBrandSchema = CreateBrandSchema.omit({ isActive: true, isPremium: true, isExclusive: true })
  .partial()
  .extend({ isActive: z.boolean().optional(), isPremium: z.boolean().optional(), isExclusive: z.boolean().optional() }); // Sin "default" en el PATCH

// ListBrandsQuerySchema => paginación + búsqueda por nombre
export const ListBrandsQuerySchema = PaginationQuerySchema.extend({
  q: z.string().trim().min(1).optional(),
  premium: queryBoolean, // RF-05.3 ?premium=true => solo marcas destacadas
  exclusive: queryBoolean, // RF-05.3 ?exclusive=true => solo exclusivas
});

export type CreateBrandInput = z.infer<typeof CreateBrandSchema>;
export type UpdateBrandInput = z.infer<typeof UpdateBrandSchema>;
export type ListBrandsQuery = z.infer<typeof ListBrandsQuerySchema>;
