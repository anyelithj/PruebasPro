import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { bearer } from '../../ai/assistant.controller';
import {
  MarkWordDto,
  WordStatusDto,
} from '../application/dtos/vocabulary-entry.dto';
import {
  GetMarkedWordUseCase,
  ListMarkedWordsUseCase,
} from '../application/use-cases/list-marked-words.use-case';
import { MarkWordLearnedUseCase } from '../application/use-cases/mark-word-learned.use-case';
import { MarkWordLearningUseCase } from '../application/use-cases/mark-word-learning.use-case';
import { UnmarkWordUseCase } from '../application/use-cases/unmark-word.use-case';
import type { WordStatus } from '../domain/entities/vocabulary-entry.entity';
// [Controller WordStatus · Sprint 10.2 · RF-137]: «Aprender» / «Aprendido» desde el diccionario — marcar, listar para resaltar, cambiar el estado y desmarcar | [Patrón]: Thin Controller | [Principio]: SRP + mínimo privilegio (siempre el usuario del token) | [Paradigma]: POO + Decoradores
// [Orden]: se registra antes que VocabularyController (si no, /vocabulary/words caería en GET /vocabulary/:id)

@ApiTags('vocabulary')
@ApiBearerAuth()
@Controller('vocabulary/words')
export class WordStatusController {
  constructor(
    private readonly mark: MarkWordLearningUseCase,
    private readonly list: ListMarkedWordsUseCase,
    private readonly get: GetMarkedWordUseCase,
    private readonly learned: MarkWordLearnedUseCase,
    private readonly unmark: UnmarkWordUseCase,
  ) {}

  @Post()
  @ApiOperation({
    summary: '«Aprender»: agrega la palabra al banco y al mazo de flashcards',
  })
  markOne(
    @CurrentUser() u: JwtPayload,
    @Body() dto: MarkWordDto,
    @Headers('authorization') auth: string,
  ) {
    return this.mark.execute(u.sub, dto, bearer(auth));
  }

  @Get()
  @ApiOperation({
    summary: 'Palabras que aprendo o aprendí (filtros: language, status)',
  })
  listMarked(
    @CurrentUser() u: JwtPayload,
    @Query('language') language?: string,
    @Query('status') status?: WordStatus,
  ) {
    return this.list.execute(u.sub, {
      language,
      status: status === 'learning' || status === 'learned' ? status : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Palabra marcada con su estado' })
  getOne(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.get.execute(u.sub, id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: '«Aprendido» o de nuevo «aprendiendo»' })
  setStatus(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WordStatusDto,
  ) {
    return this.learned.execute(u.sub, id, dto.status);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Dejar de marcar la palabra (sigue en el banco y en el mazo)',
  })
  unmarkOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.unmark.execute(u.sub, id);
  }
}
