// [DRY][DECORATOR] validación Zod reutilizable — traduce ZodError a ValidationException
import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';
import { ValidationException } from '../exceptions/validation.exception';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationException('Validation failed', error.flatten());
      }
      throw error;
    }
  }
}
