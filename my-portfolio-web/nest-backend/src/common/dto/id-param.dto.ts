// [DRY][SRP] validación de UUID en parámetros de ruta
import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export type IdParamDto = z.infer<typeof idParamSchema>;
