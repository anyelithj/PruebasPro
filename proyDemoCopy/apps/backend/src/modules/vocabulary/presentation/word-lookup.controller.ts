import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { bearer } from '../../ai/assistant.controller';
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
  ) {}

  @Post()
  @ApiOperation({ summary: 'Consultar una palabra dentro de su frase' })
  lookupOne(
    @Body() dto: LookupWordDto,
    @Headers('authorization') auth: string,
  ) {
    return this.lookup.execute(dto, bearer(auth));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Resultado guardado de una consulta de palabra' })
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.get.execute(id, 'word');
  }
}
