// social.validator.ts (Zod) => valida los query params del feed social (?page=&influencer=), que llegan del usuario.
// ".catch(...)" => un valor inválido en la URL cae al valor por defecto en vez de romper la página (robustez + SEO).
import { z } from "zod";

export const FEED_PAGE_SIZE = 12; // Tarjetas por página: primer render liviano (menos imágenes = menos datos y energía)

export const socialFeedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(500).catch(1),
  // Mismo formato de handle que el backend (social.schema.ts de Express): letras, números, "_" y "."
  influencer: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^@?[\w.]{2,30}$/)
    .transform((handle) => handle.replace(/^@/, ""))
    .optional()
    .catch(undefined),
});

export type SocialFeedQuery = z.infer<typeof socialFeedQuerySchema>;
