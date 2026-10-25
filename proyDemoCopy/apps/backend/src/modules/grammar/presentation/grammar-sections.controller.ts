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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { actorOf } from '../../music/presentation/songs.controller';
import { Role } from '../../users/domain/value-objects/role.vo';
import { SectionBody, UpdateSectionBody } from '../application/dtos/grammar.dto';
import { AddSectionUseCase } from '../application/use-cases/add-section.use-case';
import {
  GetSectionUseCase,
  ListSectionsUseCase,
} from '../application/use-cases/list-sections.use-case';
import { RemoveSectionUseCase } from '../application/use-cases/remove-section.use-case';
import { UpdateSectionUseCase } from '../application/use-cases/update-section.use-case';
// [Controller GrammarSections · Sprint 10.9 · RF-133]: secciones de una ficha — agregar, editar y quitar (TEACHER o ADMIN), listar y ver con sus ejemplos (todos) | [Patrón]: Thin Controller | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO + Decoradores

@ApiTags('grammar')
@ApiBearerAuth()
@Controller('grammar')
export class GrammarSectionsController {
  constructor(
    private readonly add: AddSectionUseCase,
    private readonly list: ListSectionsUseCase,
    private readonly get: GetSectionUseCase,
    private readonly update: UpdateSectionUseCase,
    private readonly remove: RemoveSectionUseCase,
  ) {}

  @Post('topics/:id/sections')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Agregar una sección a la ficha' })
  addOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SectionBody,
  ) {
    return this.add.execute(actorOf(u), id, body);
  }

  @Get('topics/:id/sections')
  @ApiOperation({ summary: 'Secciones de la ficha en orden' })
  listMany(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.list.execute(actorOf(u), id);
  }

  @Get('sections/:id')
  @ApiOperation({ summary: 'Una sección con sus ejemplos' })
  getOne(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.get.execute(actorOf(u), id);
  }

  @Patch('sections/:id')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Editar el texto, el tipo o el orden' })
  updateOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateSectionBody,
  ) {
    return this.update.execute(actorOf(u), id, body);
  }

  @Delete('sections/:id')
  @HttpCode(204)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Quitar la sección y sus ejemplos' })
  removeOne(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.remove.execute(actorOf(u), id);
  }
}
