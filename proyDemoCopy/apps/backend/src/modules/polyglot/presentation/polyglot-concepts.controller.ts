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
import { Roles } from '../../../shared/decorators/roles.decorator';
import { actorOf } from '../../music/presentation/songs.controller';
import { Role } from '../../users/domain/value-objects/role.vo';
import { ConceptBody, UpdateConceptBody } from '../application/dtos/polyglot.dto';
import { AddConceptUseCase } from '../application/use-cases/add-concept.use-case';
import { bearer } from '../../ai/assistant.controller';
import {
  GetComparisonTableUseCase,
  GetConceptUseCase,
} from '../application/use-cases/get-comparison-table.use-case';
import { RemoveConceptUseCase } from '../application/use-cases/remove-concept.use-case';
import { UpdateConceptUseCase } from '../application/use-cases/update-concept.use-case';
// [Controller PolyglotConcepts · Sprint 10.5 · RF-129 a RF-131]: tabla comparativa por tema e idiomas (todos) y conceptos del tema — agregar, ver, editar y quitar (TEACHER o ADMIN) | [Patrón]: Thin Controller | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO + Decoradores

@ApiTags('polyglot')
@ApiBearerAuth()
@Controller('polyglot')
export class PolyglotConceptsController {
  constructor(
    private readonly add: AddConceptUseCase,
    private readonly table: GetComparisonTableUseCase,
    private readonly get: GetConceptUseCase,
    private readonly update: UpdateConceptUseCase,
    private readonly remove: RemoveConceptUseCase,
  ) {}

  @Post('topics/:id/concepts')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Agregar una palabra o frase con su emoji o imagen' })
  addOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ConceptBody,
  ) {
    return this.add.execute(actorOf(u), id, body);
  }

  @Get('table')
  @ApiOperation({
    summary: 'Tabla del tema para los idiomas pedidos y en su orden (?topic=&languages=en,de,es)',
  })
  getTable(
    @CurrentUser() u: JwtPayload,
    @Query('topic', ParseUUIDPipe) topic: string,
    @Query('languages') languages?: string,
    @Headers('authorization') auth?: string,
  ) {
    return this.table.execute(actorOf(u), topic, languages, auth ? bearer(auth) : undefined); // [2026-10-19]: IPA que falte se completa al leer
  }

  @Get('concepts/:id')
  @ApiOperation({ summary: 'Concepto con todos sus términos' })
  getOne(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.get.execute(actorOf(u), id);
  }

  @Patch('concepts/:id')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Editar el concepto, su emoji o su imagen' })
  updateOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateConceptBody,
  ) {
    return this.update.execute(actorOf(u), id, body);
  }

  @Delete('concepts/:id')
  @HttpCode(204)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Quitar el concepto y sus términos' })
  removeOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.remove.execute(actorOf(u), id);
  }
}
