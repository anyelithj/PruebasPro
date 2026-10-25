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
import {
  ScriptTurnBody,
  UpdateTurnBody,
} from '../application/dtos/dialogue.dto';
import { AddTurnUseCase } from '../application/use-cases/add-turn.use-case';
import {
  GetTurnUseCase,
  ListTurnsUseCase,
} from '../application/use-cases/list-turns.use-case';
import { RemoveTurnUseCase } from '../application/use-cases/remove-turn.use-case';
import { UpdateTurnUseCase } from '../application/use-cases/update-turn.use-case';
// [Controller DialogueTurns · Sprint 9.3 · RF-123/RF-124]: turnos de un diálogo guionado — agregar (con traducción e IPA), listar, ver, corregir y quitar | [Patrón]: Thin Controller | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO + Decoradores

@ApiTags('dialogues')
@ApiBearerAuth()
@Controller()
export class DialogueTurnsController {
  constructor(
    private readonly add: AddTurnUseCase,
    private readonly list: ListTurnsUseCase,
    private readonly get: GetTurnUseCase,
    private readonly update: UpdateTurnUseCase,
    private readonly remove: RemoveTurnUseCase,
  ) {}

  @Post('dialogues/:id/turns')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary: 'Agregar un turno con su hablante (traducción al español e IPA)',
  })
  createOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ScriptTurnBody,
    @Headers('authorization') auth: string,
  ) {
    return this.add.execute(actorOf(u), id, body, bearer(auth));
  }

  @Get('dialogues/:id/turns')
  @ApiOperation({
    summary: 'Turnos con texto original, IPA, traducción y tiempos',
  })
  listAll(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.list.execute(actorOf(u), id);
  }

  @Get('dialogue-turns/:id')
  @ApiOperation({ summary: 'Un turno con su IPA y su traducción' })
  getOne(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.get.load(actorOf(u), id);
  }

  @Patch('dialogue-turns/:id')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary:
      'Corregir texto, IPA, traducción o tiempos (la corrección manual prevalece)',
  })
  updateOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTurnBody,
  ) {
    return this.update.execute(actorOf(u), id, body);
  }

  @Delete('dialogue-turns/:id')
  @HttpCode(204)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Quitar un turno' })
  removeOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.remove.execute(actorOf(u), id);
  }
}
