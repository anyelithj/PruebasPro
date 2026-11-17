import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { bearer } from '../../ai/assistant.controller';
import {
  LANGUAGE_TOOLS,
  type LanguageToolsPort,
} from '../../../shared/domain/interfaces/language-tools.interface';
import { LookupWordDto } from '../application/dtos/vocabulary-entry.dto';
import { GetLookupUseCase } from '../application/use-cases/lookup-term.use-case';
import { LookupWordUseCase } from '../application/use-cases/lookup-word.use-case';
// [Controller WordLookup · Sprint 8.2 · RF-136]: diccionario al pulsar una palabra — traducción según la frase, IPA y dos ejemplos (misma caché) | [Patrón]: Thin Controller | [Principio]: SRP | [Paradigma]: POO + Decoradores

@ApiTags('vocabulary')
@ApiBearerAuth()
@Controller('vocabulary/lookup/word')
export class WordLookupController {
  constructor(
    private readonly lookup: LookupWordUseCase,
    private readonly get: GetLookupUseCase,
    @Inject(LANGUAGE_TOOLS) private readonly tools: LanguageToolsPort, // `@Inject` (NestJS): el puerto se resuelve por su Symbol
  ) {}

  @Post()
  @ApiOperation({ summary: 'Consultar una palabra dentro de su frase' })
  lookupOne(
    @Body() dto: LookupWordDto,
    @Headers('authorization') auth: string,
  ) {
    return this.lookup.execute(dto, bearer(auth));
  }

  // [Fix 2026-10-31]: solo IPA (espeak-ng, milisegundos) → la ficha la muestra al instante; la traducción del LLM en CPU tarda de 5 a 50 s | [Principio]: determinístico primero
  @Post('ipa')
  @ApiOperation({ summary: 'IPA de una palabra, sin traducción' })
  ipa(@Body() dto: LookupWordDto, @Headers('authorization') auth: string) {
    return this.tools.ipa(dto.word, dto.language, bearer(auth));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Resultado guardado de una consulta de palabra' })
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.get.execute(id, 'word');
  }
}
