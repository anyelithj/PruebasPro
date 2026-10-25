// [DRY] validación Zod reutilizable en handlers Nitro.
import type { ZodSchema } from 'zod';
import { createError } from 'h3';

export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Validation failed',
      data: result.error.flatten(),
    });
  }
  return result.data;
}
