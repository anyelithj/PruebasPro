// seo.validator.ts (Zod) => valida los parámetros de URL de las secciones SEO (filtros del blog y eventos) antes de
// usarlos en consultas: un ?tag= manipulado nunca llega a la consulta (seguridad + URLs canónicas).
// También valida el slug de las rutas dinámicas (404 temprano sin consultar al backend: ahorro de peticiones).
import { z } from "zod";

export const slugParam = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120);

export const blogQuerySchema = z.object({
  category: slugParam.optional().catch(undefined), // ".catch" => valor inválido se ignora en lugar de romper la página
  tag: z.string().trim().toLowerCase().max(40).optional().catch(undefined),
});

export const eventsQuerySchema = z.object({
  past: z.enum(["1"]).optional().catch(undefined), // ?past=1 => incluir eventos terminados
  page: z.coerce.number().int().min(1).max(500).default(1).catch(1),
});

export type BlogQuery = z.infer<typeof blogQuerySchema>;
