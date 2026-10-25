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
import { actorOf } from '../../music/presentation/songs.controller';
import { UpdateViewBody, ViewBody } from '../application/dtos/polyglot.dto';
import { DeleteViewUseCase } from '../application/use-cases/delete-view.use-case';
import {
  GetViewUseCase,
  ListMyViewsUseCase,
} from '../application/use-cases/list-my-views.use-case';
import { SaveViewUseCase } from '../application/use-cases/save-view.use-case';
import { UpdateViewUseCase } from '../application/use-cases/update-view.use-case';
// [Controller PolyglotViews · Sprint 10.5 · RF-131]: comparaciones guardadas del usuario — guardar, listar, ver, cambiar idiomas u orden y borrar | [Patrón]: Thin Controller | [Principio]: SRP + mínimo privilegio (siempre el usuario del token) | [Paradigma]: POO + Decoradores
// [Orden]: «me» antes que «:id» (ParseUUIDPipe rechazaría «me»)

@ApiTags('polyglot')
@ApiBearerAuth()
@Controller('polyglot/views')
export class PolyglotViewsController {
  constructor(
    private readonly save: SaveViewUseCase,
    private readonly list: ListMyViewsUseCase,
    private readonly get: GetViewUseCase,
    private readonly update: UpdateViewUseCase,
    private readonly remove: DeleteViewUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Guardar la comparación: tema, idiomas y orden' })
  saveOne(@CurrentUser() u: JwtPayload, @Body() body: ViewBody) {
    return this.save.execute(actorOf(u), body);
  }

  @Get('me')
  @ApiOperation({ summary: 'Mis comparaciones guardadas' })
  listMine(@CurrentUser() u: JwtPayload) {
    return this.list.execute(u.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Una comparación guardada' })
  getOne(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.get.execute(u.sub, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cambiar el nombre, los idiomas o su orden' })
  updateOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateViewBody,
  ) {
    return this.update.execute(u.sub, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Borrar la comparación guardada' })
  removeOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.remove.execute(u.sub, id);
  }
}
