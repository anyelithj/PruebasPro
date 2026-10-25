import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import {
  ListMyNotificationsUseCase,
  MarkNotificationsReadUseCase,
} from '../application/use-cases/my-notifications.use-case';
// [Controller Notifications]: endpoints de la campana del topbar (solo las del usuario autenticado) | [Patrón]: Thin Controller | [Principio]: SRP + DIP | [Paradigma]: POO + Decoradores
// [Seguridad]: JwtAuthGuard global exige sesión; el userId sale del JWT, nunca del cliente

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly listMine: ListMyNotificationsUseCase,
    private readonly markRead: MarkNotificationsReadUseCase,
  ) {}

  // GET /notifications/me → { items, unread }
  @Get('me')
  @ApiOperation({
    summary: 'Mis notificaciones recientes + contador de no leídas',
  })
  mine(@CurrentUser() user: JwtPayload) {
    return this.listMine.execute(user.sub);
  }

  // PATCH /notifications/me/read → marca todas como leídas (ruta estática ANTES de ':id')
  @Patch('me/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar todas mis notificaciones como leídas' })
  readAll(@CurrentUser() user: JwtPayload) {
    return this.markRead.execute(user.sub);
  }

  // PATCH /notifications/:id/read → marca una | `ParseUUIDPipe` (NestJS): 400 si el id no es UUID
  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar una notificación como leída' })
  readOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.markRead.execute(user.sub, id);
  }
}
