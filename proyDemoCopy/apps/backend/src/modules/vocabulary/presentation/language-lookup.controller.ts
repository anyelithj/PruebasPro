import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler'; // [2026-10-24]: cupo propio para la importación masiva
import { Roles } from '../../../shared/decorators/roles.decorator';
import { Role } from '../../users/domain/value-objects/role.vo';
import { bearer } from '../../ai/assistant.controller';
import {
  DetectLanguageDto,
  LookupTermDto,
  TopicTitleDto,
  TranslateTextDto,
} from '../application/dtos/vocabulary-entry.dto';
import { Inject } from '@nestjs/common';
import {
  LANGUAGE_TOOLS,
  type LanguageToolsPort,
} from '../../../shared/domain/interfaces/language-tools.interface';
import { TopicTitleUseCase } from '../application/use-cases/topic-title.use-case';
import {
  GetLookupUseCase,
  LookupTermUseCase,
} from '../application/use-cases/lookup-term.use-case';
import { PurgeLookupCacheUseCase } from '../application/use-cases/purge-lookup-cache.use-case';
// [Controller LanguageLookup · Sprint 8.2 · RF-106/RF-107]: traducción + IPA UK/US con caché, resultado guardado y purga (ADMIN) | [Patrón]: Thin Controller | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO + Decoradores

@ApiTags('vocabulary')
@ApiBearerAuth()
@Controller('vocabulary/lookup')
export class LanguageLookupController {
  constructor(
    private readonly lookup: LookupTermUseCase,
    private readonly get: GetLookupUseCase,
    private readonly purge: PurgeLookupCacheUseCase,
    private readonly topicTitle: TopicTitleUseCase,
    @Inject(LANGUAGE_TOOLS) private readonly tools: LanguageToolsPort,
  ) {}

  // [Sprint 2.5]: traductor del lector de PDF para navegadores sin Translator API (Firefox, Safari) → mismo puerto que el traductor
  @Post('translate')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Traducir un trozo de texto (≤ 500 caracteres) entre dos idiomas',
  })
  translateOne(
    @Body() dto: TranslateTextDto,
    @Headers('authorization') auth: string,
  ) {
    return this.tools.translate(
      dto.text,
      dto.source,
      dto.target,
      bearer(auth),
      { kind: dto.tipo_de_texto, context: dto.context },
    );
  }

  // [2026-10-30]: «Detectado: X» al pulsar Enter en /traductor (FastAPI, sin LLM) | `@HttpCode(200)` (NestJS): es una consulta, no crea nada
  @Post('detect')
  @HttpCode(200)
  @ApiOperation({ summary: 'Detectar el idioma de un texto, sin traducirlo' })
  detectOne(
    @Body() dto: DetectLanguageDto,
    @Headers('authorization') auth: string,
  ) {
    return this.tools.detect(dto.text, bearer(auth));
  }

  // [2026-10-19]: el título del tema de vocabulario en el idioma estudiado, con IPA (UK/US en inglés) y la traducción al español
  // `@HttpCode(200)` (2026-10-27): es una CONSULTA (no crea nada) → 200 en vez del 201 por defecto de POST · nunca 503 (Fail Soft en el caso de uso)
  @Post('topic')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Título de un tema (español) en el idioma estudiado, con IPA',
  })
  topicOne(@Body() dto: TopicTitleDto, @Headers('authorization') auth: string) {
    return this.topicTitle.execute(dto.topic, dto.language, bearer(auth));
  }

  // [Throttle · 2026-10-24]: importar una lista de 60+ palabras (PDF/URL) completa traducción e IPA de cada una → con el cupo global (100/min por IP,
  // compartido con el resto del portal detrás del BFF) los últimos elementos recibían 429. Ruta autenticada y cacheada → contador propio más amplio
  // `@Throttle` (@nestjs/throttler v6): sobrescribe límite y ventana solo para este handler | [Patrón]: Per-Route Policy
  @Post()
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Traducir un término o frase y obtener IPA UK y US (caché primero)',
  })
  lookupOne(
    @Body() dto: LookupTermDto,
    @Headers('authorization') auth: string,
  ) {
    return this.lookup.execute(dto, bearer(auth));
  }

  // [Orden]: «cache» antes que «:id» no es necesario (DELETE no tiene :id), pero se declara primero por claridad
  @Delete('cache')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Purgar la caché de traducciones e IPA (solo ADMIN)',
  })
  purgeCache() {
    return this.purge.execute();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Resultado guardado de una consulta' })
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.get.execute(id, 'term');
  }
}
