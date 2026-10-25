// [DRY][CC-N] Zod: name + email + password
import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export type RegisterDto = z.infer<typeof registerSchema>;
