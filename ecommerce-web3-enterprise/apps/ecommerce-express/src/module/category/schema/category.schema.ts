// category.schema.ts => validación Zod del módulo Category (fuente única de tipos de entrada, DRY).
import { z } from "zod";

// CreateCategorySchema => POST /api/v1/category ("crear categoría o subcategoría")
export const CreateCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().regex(/^[a-z0-9-]+$/, { message: "Slug: minúsculas, números y guiones" }).optional(), // Si falta se genera del nombre
  description: z.string().trim().max(1000).optional(),
  imageUrl: z.string().url().optional(),
  parentId: z.string().uuid().nullable().optional(), // null/undefined => categoría raíz
  position: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

// UpdateCategorySchema => PATCH parcial ("actualizar nombre, imagen o jerarquía")
// ".partial()" => todos opcionales; ".omit" quita los defaults para no sobreescribir con valores por defecto
export const UpdateCategorySchema = CreateCategorySchema.omit({ position: true, isActive: true })
  .partial()
  .extend({ position: z.number().int().min(0).optional(), isActive: z.boolean().optional() });

// DeleteCategoryQuerySchema => "eliminar y reasignar productos": destino opcional (por defecto, la categoría padre)
export const DeleteCategoryQuerySchema = z.object({ reassignTo: z.string().uuid().optional() });

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
