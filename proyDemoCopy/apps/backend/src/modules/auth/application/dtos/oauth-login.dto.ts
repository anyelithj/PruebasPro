import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MinLength } from 'class-validator';
// [DTO OAuthLogin]: entrada para intercambio id_token → JWT propio | [Patrón]: DTO | [Principio]: ISP

export class OAuthLoginDto {
  @ApiProperty({ enum: ['google', 'microsoft'], example: 'google' })
  @IsString()
  @IsIn(['google', 'microsoft'])
  provider!: 'google' | 'microsoft';

  @ApiProperty({ description: 'OIDC id_token emitido por el provider' })
  @IsString()
  @MinLength(20)
  idToken!: string;
}
