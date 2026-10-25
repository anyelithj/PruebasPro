// landing.validator.ts (Zod) => schema del formulario de captura de leads (mismas reglas que LeadSchema de Express:
// email válido y consentimiento EXPLÍCITO de tratamiento de datos, GDPR / Ley 1581). Mensajes = claves de i18n.
import { z } from "zod";

export const leadSchema = z.object({
  email: z.string().trim().toLowerCase().email("validation.email"),
  name: z.string().trim().max(120).optional().transform((value) => value || undefined),
  // "literal(true)" => la casilla debe estar marcada (no se acepta un consentimiento implícito)
  consent: z.literal(true, { errorMap: () => ({ message: "validation.consent" }) }),
});

export type LeadForm = z.input<typeof leadSchema>;
export type LeadValues = z.output<typeof leadSchema>;
