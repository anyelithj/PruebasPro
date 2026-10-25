// collection.schema.ts => validación Zod del módulo Collection.
import { z } from "zod";

// Base común de creación/edición: la vigencia debe ser coherente (endsAt posterior a startsAt)
const CollectionFields = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().trim().max(2000).optional(),
  imageUrl: z.string().url().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
  // RF-04.2 / RF-05.5: descuento automático (1-90 %) al llevar el look completo; null => sin descuento
  lookDiscountPercent: z.number().int().min(1).max(90).nullable().optional(),
  // Orden manual: la posición en el arreglo ES el orden en la colección
  productIds: z.array(z.string().uuid()).max(500).optional(),
});

// ".refine" => validación cruzada entre campos (no expresable campo a campo)
const validWindow = (value: { startsAt?: Date | undefined; endsAt?: Date | undefined }) =>
  !value.startsAt || !value.endsAt || value.endsAt > value.startsAt;

export const CreateCollectionSchema = CollectionFields.refine(validWindow, {
  message: "endsAt debe ser posterior a startsAt",
  path: ["endsAt"],
});

export const UpdateCollectionSchema = CollectionFields.partial().refine(validWindow, {
  message: "endsAt debe ser posterior a startsAt",
  path: ["endsAt"],
});

export type CreateCollectionInput = z.infer<typeof CreateCollectionSchema>;
export type UpdateCollectionInput = z.infer<typeof UpdateCollectionSchema>;
