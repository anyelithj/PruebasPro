import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { SongPracticeBody } from '../application/dtos/song.dto';
import { GenerateSongPracticeUseCase } from '../application/use-cases/generate-song-practice.use-case';
import { ListSongPracticesUseCase } from '../application/use-cases/list-song-practices.use-case';
import { actorOf } from './songs.controller';
// [Controller SongPractices · Sprint 9.10 · RF-120]: generar (o reutilizar) y listar las prácticas de una canción — cualquier usuario que pueda verla | [Patrón]: Thin Controller | [Principio]: SRP + bajo acoplamiento (la actividad se resuelve en Practice) | [Paradigma]: POO + Decoradores

@ApiTags('music')
@ApiBearerAuth()
@Controller('music/songs/:id/practice')
export class SongPracticesController {
  constructor(
    private readonly generate: GenerateSongPracticeUseCase,
    private readonly list: ListSongPracticesUseCase,
  ) {}

  @Post()
  @ApiOperation({
    summary:
      'Generar la práctica: completar la letra, ordenar versos o marcar la palabra intrusa',
  })
  createOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SongPracticeBody,
  ) {
    return this.generate.execute(actorOf(u), id, body.kind);
  }

  @Get()
  @ApiOperation({ summary: 'Prácticas generadas de la canción' })
  listAll(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.list.execute(actorOf(u), id);
  }
}
