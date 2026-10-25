// [OCP] extiende create sin modificarlo — partial + campos de gestión
import { z } from 'zod';
import { createUserSchema } from './create-user.dto';

export const updateUserSchema = createUserSchema
  .pick({ name: true, email: true })
  .partial()
  .extend({ isActive: z.boolean().optional() });

export type UpdateUserDto = z.infer<typeof updateUserSchema>;
