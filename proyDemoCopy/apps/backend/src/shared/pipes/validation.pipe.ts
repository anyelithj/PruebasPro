import { ValidationPipe, ValidationPipeOptions } from '@nestjs/common';
// [Pipe global de validación]: aplica class-validator/transformer a todo body/query/param | [Patrón]: Pipe (Chain of Responsibility) | [Principio]: DRY | [Paradigma]: AOP

// [Opciones endurecidas]: rechaza propiedades no declaradas en DTOs (anti mass-assignment)
export const GLOBAL_VALIDATION_OPTIONS: ValidationPipeOptions = {
  // [whitelist]: descarta props no decoradas con @IsXxx en el DTO
  whitelist: true,
  // [forbidNonWhitelisted]: 400 si llegan props extra (vs. simplemente borrarlas)
  forbidNonWhitelisted: true,
  // [transform]: convierte payload plain → instancia de la clase DTO
  transform: true,
  // [transformOptions]: coerción de tipos primitivos (string '5' → number 5)
  transformOptions: { enableImplicitConversion: true },
  // [stopAtFirstError]: latencia baja en validaciones de campos múltiples
  stopAtFirstError: false,
};

// [Factory]: instancia única reutilizable | [Patrón]: Singleton | [Principio]: DRY
export const globalValidationPipe = (): ValidationPipe =>
  new ValidationPipe(GLOBAL_VALIDATION_OPTIONS);
