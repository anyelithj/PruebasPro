import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsString } from 'class-validator';
// [DTO Refresh]: input del endpoint POST /auth/refresh | [Patrón]: DTO | [Principio]: SRP | [Paradigma]: Declarativo

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token JWT',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsJWT({ message: 'Provided value is not a valid JWT' })
  refreshToken!: string;
}
