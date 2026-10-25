import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { Role } from '../../users/domain/value-objects/role.vo';
import {
  GetRefundUseCase,
  ListRefundsUseCase,
} from '../application/use-cases/list-refunds.use-case';
import { RefundPaymentUseCase } from '../application/use-cases/refund-payment.use-case';
// [Controller Refunds · Sprint 7.3]: reembolsar un pago y consultar reembolsos | [Patrón]: Thin Controller | [Principio]: SRP + mínimo privilegio (solo ADMIN) | [Paradigma]: POO + Decoradores

// [DTO]: monto en centavos (opcional = lo que falta) y motivo para la auditoría
export class RefundBody {
  @IsOptional() @IsInt() @Min(1) amountMinor?: number;
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

export class RefundsQuery {
  @IsOptional() @IsUUID('all') paymentId?: string;
}

@ApiTags('payments')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('payments')
export class RefundsController {
  constructor(
    private readonly refund: RefundPaymentUseCase,
    private readonly list: ListRefundsUseCase,
    private readonly getOne: GetRefundUseCase,
  ) {}

  @Post(':id/refund')
  @ApiOperation({
    summary: 'Reembolso total o parcial (revoca el acceso si es total)',
  })
  create(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RefundBody,
  ) {
    return this.refund.execute(user.sub, id, body.amountMinor, body.reason);
  }

  @Get('refunds')
  @ApiOperation({ summary: 'Listado de reembolsos' })
  all(@Query() q: RefundsQuery) {
    return this.list.execute(q.paymentId);
  }

  @Get('refunds/:id')
  @ApiOperation({ summary: 'Detalle del reembolso' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.getOne.execute(id);
  }
}
