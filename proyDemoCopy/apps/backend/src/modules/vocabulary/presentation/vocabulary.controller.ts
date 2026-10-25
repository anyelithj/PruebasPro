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
  CreateVocabularyEntryDto,
  UpdateVocabularyEntryDto,
} from '../application/dtos/vocabulary-entry.dto';
import { CreateVocabularyEntryUseCase } from '../application/use-cases/create-vocabulary-entry.use-case';
import { DeleteVocabularyEntryUseCase } from '../application/use-cases/delete-vocabulary-entry.use-case';
import {
  GetVocabularyEntryUseCase,
  ListMyVocabularyUseCase,
} from '../application/use-cases/list-my-vocabulary.use-case';
import { UpdateVocabularyEntryUseCase } from '../application/use-cases/update-vocabulary-entry.use-case';
// [Controller Vocabulary · Sprint 8.2 · RF-109]: banco de vocabulario del usuario — crear (con traducción e IPA automáticos), listar, ver, corregir y borrar | [Patrón]: Thin Controller | [Principio]: SRP + mínimo privilegio (todo filtrado por el usuario del token) | [Paradigma]: POO + Decoradores

@ApiTags('vocabulary')
@ApiBearerAuth()
@Controller('vocabulary')
export class VocabularyController {
  constructor(
    private readonly create: CreateVocabularyEntryUseCase,
    private readonly list: ListMyVocabularyUseCase,
    private readonly get: GetVocabularyEntryUseCase,
    private readonly update: UpdateVocabularyEntryUseCase,
    private readonly remove: DeleteVocabularyEntryUseCase,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Agregar un término y completar traducción e IPA UK/US',
  })
  createOne(
    @CurrentUser() u: JwtPayload,
    @Body() dto: CreateVocabularyEntryDto,
    @Headers('authorization') auth: string,
  ) {
    return this.create.execute(u.sub, dto, bearer(auth));
  }

  @Get()
  @ApiOperation({ summary: 'Mi banco de vocabulario (filtros: language, q)' })
  listMine(
    @CurrentUser() u: JwtPayload,
    @Query('language') language?: string,
    @Query('q') q?: string,
  ) {
    return this.list.execute(u.sub, { language, q });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Entrada con traducción, IPA UK/US y ejemplo' })
  getOne(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.get.execute(u.sub, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Corregir traducción, IPA o ejemplo (la corrección manual prevalece)',
  })
  updateOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVocabularyEntryDto,
  ) {
    return this.update.execute(u.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar una entrada propia' })
  removeOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.remove.execute(u.sub, id);
  }
}
