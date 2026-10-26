import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from '../../../users/domain/value-objects/role.vo';
import { OptionalPhone } from '../../../users/application/dtos/optional-phone.decorator'; // [2026-10-24]: misma regla de teléfono que Mi perfil y Gestión | [Principio]: DRY
// [DTO Register]: input del endpoint POST /auth/register | [Patrón]: DTO | [Principio]: SRP + ISP | [Paradigma]: POO + Declarativo (decorators)

export class RegisterDto {
  // [Email]: validado por class-validator + transformado a lowercase en el use case
  @ApiProperty({ example: 'student@neuroedu.ia' })
  @IsEmail({}, { message: 'Email format is invalid' })
  @MaxLength(320, { message: 'Email exceeds RFC max length (320)' })
  email!: string;

  // [Password]: 8+ chars, al menos 1 mayúscula, 1 minúscula, 1 dígito
  @ApiProperty({
    example: 'StrongP@ss123',
    description: 'Min 8 chars, 1 uppercase, 1 lowercase, 1 digit',
  })
  @IsString()
  @MinLength(8, { message: 'Password too short (min 8)' })
  @MaxLength(128, { message: 'Password too long (max 128)' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Password must contain uppercase, lowercase, and digit',
  })
  password!: string;

  @ApiProperty({ example: 'Juan' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @ApiProperty({ example: 'Andrés' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;

  // [Teléfono · 2026-10-24]: opcional en el alta pública (mismo dominio que Mi perfil) | `@OptionalPhone` = IsOptional + IsString + MaxLength + Matches | `?:` (TS): propiedad opcional
  @OptionalPhone()
  phone?: string;

  // [Rol opcional]: default USER en backend (no se confía en el cliente para roles altos)
  @ApiProperty({ enum: Role, required: false, default: Role.USER })
  @IsOptional()
  @IsEnum(Role, { message: 'Invalid role' })
  role?: Role;
}
