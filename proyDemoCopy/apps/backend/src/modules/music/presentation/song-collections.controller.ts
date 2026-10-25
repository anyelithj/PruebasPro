import {
  Body,
  Controller,
  Delete,
  Get,
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
import { Roles } from '../../../shared/decorators/roles.decorator';
import { Role } from '../../users/domain/value-objects/role.vo';
import {
  CollectionBody,
  UpdateCollectionBody,
} from '../application/dtos/song.dto';
import { ArchiveCollectionUseCase } from '../application/use-cases/archive-collection.use-case';
import { CreateCollectionUseCase } from '../application/use-cases/create-collection.use-case';
import { GetCollectionUseCase } from '../application/use-cases/get-collection.use-case';
import { ListCollectionsUseCase } from '../application/use-cases/list-collections.use-case';
import { UpdateCollectionUseCase } from '../application/use-cases/update-collection.use-case';
import { actorOf } from './songs.controller';
// [Controller SongCollections · Sprint 9.2 · RF-115]: colecciones — listar y ver (todos), crear, editar y archivar (TEACHER o ADMIN) | [Patrón]: Thin Controller | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO + Decoradores

@ApiTags('music')
@ApiBearerAuth()
@Controller('music/collections')
export class SongCollectionsController {
  constructor(
    private readonly create: CreateCollectionUseCase,
    private readonly list: ListCollectionsUseCase,
    private readonly get: GetCollectionUseCase,
    private readonly update: UpdateCollectionUseCase,
    private readonly archive: ArchiveCollectionUseCase,
  ) {}

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Crear colección por idioma, nivel o tema' })
  createOne(@CurrentUser() u: JwtPayload, @Body() body: CollectionBody) {
    return this.create.execute(actorOf(u), body);
  }

  @Get()
  @ApiOperation({ summary: 'Colecciones por idioma y nivel' })
  listAll(
    @Query('language') language?: string,
    @Query('level') level?: string,
  ) {
    return this.list.execute({ language, level });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Colección con sus canciones ordenadas' })
  getOne(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.get.execute(actorOf(u), id);
  }

  @Patch(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary: 'Editar nombre, descripción y canciones de la colección',
  })
  updateOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCollectionBody,
  ) {
    return this.update.execute(actorOf(u), id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Archivar la colección (borrado lógico)' })
  archiveOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.archive.execute(actorOf(u), id);
  }
}
