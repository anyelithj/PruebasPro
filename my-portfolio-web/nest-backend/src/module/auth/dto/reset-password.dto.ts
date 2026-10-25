// [DRY][CC-N] Zod: token del enlace + contraseña nueva
import { z } from 'zod';

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8).max(128),
});

export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
