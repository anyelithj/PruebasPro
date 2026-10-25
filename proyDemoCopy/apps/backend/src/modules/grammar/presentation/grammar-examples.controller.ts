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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { bearer } from '../../ai/assistant.controller';
import { actorOf } from '../../music/presentation/songs.controller';
import { Role } from '../../users/domain/value-objects/role.vo';
import { ExampleBody, UpdateExampleBody } from '../application/dtos/grammar.dto';
import { AddExampleUseCase } from '../application/use-cases/add-example.use-case';
import {
  GetExampleUseCase,
  ListExamplesUseCase,
} from '../application/use-cases/list-sections.use-case';
import { RemoveExampleUseCase } from '../application/use-cases/remove-example.use-case';
import { UpdateExampleUseCase } from '../application/use-cases/update-example.use-case';
// [Controller GrammarExamples · Sprint 10.9 · RF-134]: ejemplos de una sección — agregar con IPA y traducción, corregir y quitar (TEACHER o ADMIN), listar y ver (todos) | [Patrón]: Thin Controller | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO + Decoradores

@ApiTags('grammar')
@ApiBearerAuth()
@Controller('grammar')
export class GrammarExamplesController {
  constructor(
    private readonly add: AddExampleUseCase,
    private readonly list: ListExamplesUseCase,
    private readonly get: GetExampleUseCase,
    private readonly update: UpdateExampleUseCase,
    private readonly remove: RemoveExampleUseCase,
  ) {}

  @Post('sections/:id/examples')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Agregar un ejemplo con su IPA y su traducción' })
  addOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ExampleBody,
    @Headers('authorization') auth: string,
  ) {
    return this.add.execute(actorOf(u), id, body, bearer(auth));
  }

  @Get('sections/:id/examples')
  @ApiOperation({ summary: 'Ejemplos de la sección con IPA y traducción' })
  listMany(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.list.execute(actorOf(u), id);
  }

  @Get('examples/:id')
  @ApiOperation({ summary: 'Un ejemplo con su IPA y su traducción' })
  getOne(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.get.execute(actorOf(u), id);
  }

  @Patch('examples/:id')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Corregir el texto, el IPA o la traducción (la corrección manual prevalece)' })
  updateOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateExampleBody,
    @Headers('authorization') auth: string,
  ) {
    return this.update.execute(actorOf(u), id, body, bearer(auth));
  }

  @Delete('examples/:id')
  @HttpCode(204)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Quitar el ejemplo' })
  removeOne(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.remove.execute(actorOf(u), id);
  }
}
