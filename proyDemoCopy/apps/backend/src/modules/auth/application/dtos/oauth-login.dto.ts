import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MinLength } from 'class-validator';
// [DTO OAuthLogin]: entrada para intercambio id_token → JWT propio | [Patrón]: DTO | [Principio]: ISP

export class OAuthLoginDto {
  // [2026-11-16]: solo Google (Microsoft retirado) | `@IsIn` (class-validator): rechaza cualquier otro proveedor con 400
  @ApiProperty({ enum: ['google'], example: 'google' })
  @IsString()
  @IsIn(['google'])
  provider!: 'google';

  @ApiProperty({ description: 'OIDC id_token emitido por el provider' })
  @IsString()
  @MinLength(20)
  idToken!: string;
}
