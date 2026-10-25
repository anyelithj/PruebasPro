import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
// [DTO Login]: input del endpoint POST /auth/login | [Patrón]: DTO | [Principio]: SRP | [Paradigma]: Declarativo

export class LoginDto {
  @ApiProperty({ example: 'student@neuroedu.ia' })
  @IsEmail({}, { message: 'Email format is invalid' })
  email!: string;

  @ApiProperty({ example: 'StrongP@ss123' })
  @IsString()
  @MinLength(8, { message: 'Password too short' })
  password!: string;
}
