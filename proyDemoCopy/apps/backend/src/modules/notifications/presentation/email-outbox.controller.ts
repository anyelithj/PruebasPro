import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { Role } from '../../users/domain/value-objects/role.vo';
import {
  ListEmailOutboxQuery,
  RetryEmailUseCase,
} from '../application/use-cases/retry-email.use-case';
import type { EmailStatus } from '../domain/entities/email-outbox.entity';
// [Controller EmailOutbox · Sprint 7.15]: bandeja de salida de correos (ADMIN) — listar por estado y reintentar fallidos | [Patrón]: Thin Controller | [Principio]: SRP + mínimo privilegio (`@Roles(ADMIN)` en toda la clase) | [Paradigma]: POO + Decoradores

export class OutboxQuery {
  @IsOptional() @IsIn(['pending', 'sent', 'failed']) status?: EmailStatus;
}

@ApiTags('notifications')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('notifications/email')
export class EmailOutboxController {
  constructor(
    private readonly list: ListEmailOutboxQuery,
    private readonly retry: RetryEmailUseCase,
  ) {}

  @Get('outbox')
  @ApiOperation({ summary: 'Bandeja de salida de correos (sin cuerpo)' })
  findAll(@Query() q: OutboxQuery) {
    return this.list.execute(q.status);
  }

  @Patch(':id/retry')
  @ApiOperation({ summary: 'Reintentar un correo fallido' })
  retryOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.retry.execute(id);
  }
}
