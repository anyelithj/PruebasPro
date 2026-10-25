// [DRY] Zod schema tipado — payload público del formulario de contacto
import { z } from 'zod';

export const createContactSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(255),
  message: z.string().min(10).max(2000),
});

export type CreateContactDto = z.infer<typeof createContactSchema>;
