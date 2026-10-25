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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  PartialType,
} from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { Role } from '../../users/domain/value-objects/role.vo';
import { AddItemUseCase } from '../application/use-cases/add-item.use-case';
import {
  GetItemUseCase,
  ListItemsUseCase,
} from '../application/use-cases/list-items.use-case';
import { RemoveItemUseCase } from '../application/use-cases/remove-item.use-case';
import { UpdateItemUseCase } from '../application/use-cases/update-item.use-case';
import { actorOf, ItemBody } from './practice-activities.controller';
// [Controller PracticeItems · Sprint 8.12 · RF-110 a RF-113]: ítems de una actividad — agregar, listar, ver, editar y quitar | [Patrón]: Thin Controller | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO + Decoradores

export class UpdateItemBody extends PartialType(ItemBody) {}

@ApiTags('practice')
@ApiBearerAuth()
@Controller('practice')
export class PracticeItemsController {
  constructor(
    private readonly add: AddItemUseCase,
    private readonly list: ListItemsUseCase,
    private readonly get: GetItemUseCase,
    private readonly update: UpdateItemUseCase,
    private readonly remove: RemoveItemUseCase,
  ) {}

  @Post('activities/:id/items')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary:
      'Agregar un ítem (tipo, habilidad, respuestas aceptadas, explicación y consejo)',
  })
  addOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ItemBody,
  ) {
    return this.add.execute(actorOf(u), id, body);
  }

  @Get('activities/:id/items')
  @ApiOperation({ summary: 'Ítems de la actividad' })
  listOf(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.list.execute(actorOf(u), id);
  }

  @Get('items/:id')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Ítem completo (solo docente o ADMIN)' })
  getOne(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.get.execute(actorOf(u), id);
  }

  @Patch('items/:id')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Editar un ítem' })
  updateOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateItemBody,
  ) {
    return this.update.execute(actorOf(u), id, body);
  }

  @Delete('items/:id')
  @HttpCode(204)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Quitar un ítem' })
  removeOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.remove.execute(actorOf(u), id);
  }
}
