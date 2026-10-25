// review.validator.ts => reglas del formulario de reseña (espejo de las del backend: feedback inmediato).
// Mensajes = claves de traducción (messages/*.json -> "validation").
import { z } from "zod";

export const reviewSchema = z.object({
  rating: z.number({ invalid_type_error: "validation.ratingRequired" }).int().min(1, "validation.ratingRequired").max(5),
  title: z.string().trim().min(3, "validation.min3").max(120),
  body: z.string().trim().min(10, "validation.reviewBody").max(3000),
});

export type ReviewFormValues = z.infer<typeof reviewSchema>;
