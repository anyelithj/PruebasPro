// [MVC-C][SRP] entrada HTTP de notificaciones — envío + listado (solo admin). Delega.
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ROLE_ADMIN } from 'src/common/constants/roles.constants';
import { Roles } from 'src/common/decorators/roles.decorator';
import { idParamSchema } from 'src/common/dto/id-param.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { SendNotificationDto, sendNotificationSchema } from '../dto/send-notification.dto';
import { NotificationService } from '../service/notification.service';
import { NOTIFICATION_ROUTES } from '../route/notification.routes';

@Controller(NOTIFICATION_ROUTES.ROOT)
@UseGuards(RolesGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  @Roles(ROLE_ADMIN)
  send(@Body(new ZodValidationPipe(sendNotificationSchema)) dto: SendNotificationDto) {
    return this.notificationService.send(dto);
  }

  @Get()
  @Roles(ROLE_ADMIN)
  list(@Query('page') page = '1', @Query('pageSize') pageSize = '20') {
    return this.notificationService.list(parseInt(page, 10) || 1, parseInt(pageSize, 10) || 20);
  }

  @Get(NOTIFICATION_ROUTES.BY_ID)
  @Roles(ROLE_ADMIN)
  get(@Param(new ZodValidationPipe(idParamSchema)) params: { id: string }) {
    return this.notificationService.getById(params.id);
  }
}
