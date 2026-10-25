// payment.validator.ts => aceptación explícita de términos antes de pagar (requisito legal de comercio electrónico).
import { z } from "zod";

export const paymentConsentSchema = z.object({
  // El mensaje es una clave de traducción (messages/*.json -> validation.acceptTerms)
  // boolean + refine (y no z.literal(true)) => el valor inicial del checkbox puede ser "false" con tipos correctos
  acceptTerms: z.boolean().refine((accepted) => accepted, "validation.acceptTerms"),
});

export type PaymentConsentValues = z.infer<typeof paymentConsentSchema>;
