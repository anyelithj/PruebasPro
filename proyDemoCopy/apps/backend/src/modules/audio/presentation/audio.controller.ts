import {
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { Response } from 'express';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { Language } from '../../../shared/domain/language.vo';
import { Role } from '../../users/domain/value-objects/role.vo';
import { GetAudioUseCase } from '../application/use-cases/get-audio.use-case';
import { InvalidateAudioUseCase } from '../application/use-cases/invalidate-audio.use-case';
import { sendRanged } from '../../../shared/http/ranged-response'; // [Sprint 6.6]: 200/206/416 compartido (DRY)
// [Controller Audio · Sprint 4.7]: audio de pronunciación bajo demanda con caché (Cache-Aside) y lectura por rangos | [Patrón]: Thin Controller | [Principio]: SRP | [Tecnología]: NestJS + Express (streaming) + Swagger
// [Seguridad]: JwtAuthGuard global (cualquier usuario autenticado escucha) · invalidar = solo ADMIN

// [DTO de consulta]: valida en la frontera | `@Matches` (class-validator): variante BCP-47 (en-GB, es-419…)
export class AudioQueryDto {
  @ApiProperty({ example: 'water' })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  text!: string;
  @ApiProperty({ enum: Language }) @IsEnum(Language) language!: Language;
  @ApiPropertyOptional({ example: 'en-GB' })
  @IsOptional()
  @Matches(/^[a-z]{2}-[A-Z0-9]{2,3}$/)
  variant?: string;
}

@ApiTags('audio')
@ApiBearerAuth()
@Controller('audio')
export class AudioController {
  constructor(
    private readonly getAudio: GetAudioUseCase,
    private readonly invalidateAudio: InvalidateAudioUseCase,
  ) {}

  // `@Res()` (NestJS): respuesta manual de Express → se transmite el audio por partes (stream), sin cargarlo entero
  @Get()
  @ApiOperation({
    summary:
      'Audio WAV de una palabra o frase (se genera solo la primera vez; admite Range → 206)',
  })
  async get(
    @Query() q: AudioQueryDto,
    @Headers('authorization') auth: string | undefined,
    @Headers('range') rangeHeader: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const token = (auth ?? '').replace(/^Bearer\s+/i, ''); // JWT del usuario → FastAPI (mismo patrón que Quiz)
    const audio = await this.getAudio.execute(q, token);
    res.setHeader('Cache-Control', 'private, max-age=86400'); // [Rendimiento]: el navegador reutiliza el audio un día
    res.setHeader('X-Audio-Cache', audio.cached ? 'hit' : 'miss'); // Trazabilidad: ¿se llamó al motor de voz?
    res.setHeader('X-Audio-Variant', audio.variant);
    await sendRanged(res, rangeHeader, { ...audio, contentType: 'audio/wav' }); // Almacén → cliente por partes
  }

  @Delete(':key')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Invalidar un audio de la caché (ADMIN) — se regenera en la próxima petición',
  })
  remove(@Param('key') key: string) {
    return this.invalidateAudio.execute(key);
  }
}
