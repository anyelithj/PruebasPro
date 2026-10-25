// [DRY][LSP] contratos Zod del CRUD admin del blog — reflejan los DTO de Nest.
import { z } from 'zod';

export const createPostSchema = z.object({
  title: z.string().min(1, 'Título requerido').max(200),
  excerpt: z.string().min(1, 'Resumen requerido').max(400),
  content: z.string().min(1, 'Contenido requerido'),
  tags: z.array(z.string().min(1).max(60)).max(30).default([]),
  imageUrl: z.string().url().max(500).optional(),
  published: z.boolean().default(false),
});

// update = todos opcionales
export const updatePostSchema = createPostSchema.partial();

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
