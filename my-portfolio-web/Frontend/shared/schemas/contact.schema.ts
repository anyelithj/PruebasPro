// [DRY] única fuente de verdad para contacto — la usan el form, el server BFF y el backend.
import { z } from 'zod';

export const contactSchema = z.object({
  name: z.string().min(1, 'Name required').max(120),
  email: z.string().email('Invalid email'),
  message: z.string().min(10, 'Message too short').max(2000),
});

export type ContactInput = z.infer<typeof contactSchema>;
