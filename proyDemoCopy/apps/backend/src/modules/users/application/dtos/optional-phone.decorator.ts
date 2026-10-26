import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import {
  PHONE_EXAMPLE,
  PHONE_INVALID_MESSAGE,
  PHONE_MAX_LENGTH,
  PHONE_PATTERN,
} from '../../domain/value-objects/phone.vo';
// [@OptionalPhone · 2026-10-24]: decorador compuesto del campo `phone` para TODOS los DTOs (RegisterDto, UpdateProfileDto, AdminCreate/UpdateUserDto) | [Patrón]: Decorator + Composite (agrupa varios decoradores en uno) | [Principio]: DRY + SSOT (una sola regla) + OCP (cambiar la regla = tocar phone.vo.ts) | [Paradigma]: Declarativo (metaprogramación con decoradores)

// `export const` + arrow function (ES2015): fábrica de decoradores sin estado → se invoca como `@OptionalPhone()`
export const OptionalPhone = (): PropertyDecorator =>
  // `applyDecorators` (NestJS): aplica en orden la lista de decoradores sobre la misma propiedad
  applyDecorators(
    // `@ApiProperty` (Swagger): documenta el campo como opcional con ejemplo
    ApiProperty({
      required: false,
      example: PHONE_EXAMPLE,
      maxLength: PHONE_MAX_LENGTH,
    }),
    // `@IsOptional` (class-validator): `undefined`/`null` saltan el resto de validaciones → campo opcional
    IsOptional(),
    // `@IsString` (class-validator): rechaza números/objetos (la regex solo tiene sentido sobre strings)
    IsString({ message: PHONE_INVALID_MESSAGE }),
    // `@MaxLength` (class-validator): defensa extra alineada con `varchar(30)` de la columna
    MaxLength(PHONE_MAX_LENGTH, { message: PHONE_INVALID_MESSAGE }),
    // `@Matches` (class-validator): regex permisiva E.164-ish; cadena vacía = borrar el teléfono
    Matches(PHONE_PATTERN, { message: PHONE_INVALID_MESSAGE }),
  );
