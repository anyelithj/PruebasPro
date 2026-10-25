// [DRY] única fuente de verdad para proyectos — valida lo que devuelve el backend.
import { z } from 'zod';

export const projectSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  link: z.string().url().or(z.string()),
  techs: z.array(z.string()).default([]),
  imageUrl: z.string().url().nullish(),
});

export const projectListSchema = z.array(projectSchema);

export type ProjectDto = z.infer<typeof projectSchema>;
