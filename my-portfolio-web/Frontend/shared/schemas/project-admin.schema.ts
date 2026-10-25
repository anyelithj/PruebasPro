// [DRY][LSP] contratos Zod del CRUD admin de proyectos — reflejan los DTO de Nest/FastAPI.
import { z } from 'zod';

export const createProjectSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().min(1).max(2000),
  link: z.string().url().max(500),
  techs: z.array(z.string().min(1).max(60)).max(30).default([]),
  featured: z.boolean().default(false),
  imageUrl: z.string().url().max(500).optional(),
});

// update = todos opcionales
export const updateProjectSchema = createProjectSchema.partial();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
