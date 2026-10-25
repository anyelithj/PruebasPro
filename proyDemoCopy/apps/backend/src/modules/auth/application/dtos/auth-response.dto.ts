import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../../users/domain/value-objects/role.vo';
// [DTO Response]: forma de salida estable para auth endpoints | [Patrón]: DTO | [Principio]: ISP | [Paradigma]: POO

// [Snapshot del usuario]: subset seguro (sin passwordHash) para exponer al frontend
export class AuthUserDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ enum: Role }) role!: Role;
  @ApiProperty() isEmailVerified!: boolean;
}

// [Respuesta login/register/refresh]: tokens + perfil mínimo | [Patrón]: Composite
export class AuthResponseDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ example: 900, description: 'Access token TTL in seconds' })
  accessExpiresIn!: number;
  @ApiProperty({ example: 'Bearer' })
  tokenType!: 'Bearer';
  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}
