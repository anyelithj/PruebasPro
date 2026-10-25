// [SRP] el admin solo mueve el estado del envío; el contenido es inmutable.
import { z } from 'zod';

export const CONTACT_STATUSES = ['pending', 'read', 'replied', 'archived'] as const;

export const updateContactSchema = z.object({
  status: z.enum(CONTACT_STATUSES),
});

export type UpdateContactDto = z.infer<typeof updateContactSchema>;
