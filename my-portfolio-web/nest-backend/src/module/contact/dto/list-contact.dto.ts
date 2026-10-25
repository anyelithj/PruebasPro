// [OCP] paginación base + filtro opcional por estado
import { z } from 'zod';
import { paginationSchema } from 'src/common/dto/pagination.dto';
import { CONTACT_STATUSES } from './update-contact.dto';

export const listContactSchema = paginationSchema.extend({
  status: z.enum(CONTACT_STATUSES).optional(),
});

export type ListContactDto = z.infer<typeof listContactSchema>;
