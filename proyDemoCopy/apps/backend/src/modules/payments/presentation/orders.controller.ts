import {
  Body,
  Controller,
  Get,
  Param,
  Res,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { CreateOrderDto } from '../application/dtos/create-order.dto';
import { CancelOrderUseCase } from '../application/use-cases/cancel-order.use-case';
import { CreateOrderUseCase } from '../application/use-cases/create-order.use-case';
import { GetInvoiceUseCase } from '../application/use-cases/get-invoice.use-case';
import type { Response } from 'express';
import {
  GetOrderUseCase,
  ListMyOrdersUseCase,
} from '../application/use-cases/list-my-orders.use-case';
// [Controller Orders · Sprint 7.3]: crear, listar, ver y cancelar órdenes de compra | [Patrón]: Thin Controller | [Principio]: SRP + DIP | [Paradigma]: POO + Decoradores
// [Seguridad]: JWT global (cualquier rol autenticado compra) · cada usuario solo ve sus órdenes (ADMIN ve todas en el detalle)

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments/orders')
export class OrdersController {
  constructor(
    private readonly create: CreateOrderUseCase,
    private readonly listMine: ListMyOrdersUseCase,
    private readonly getOne: GetOrderUseCase,
    private readonly cancelOne: CancelOrderUseCase,
    private readonly invoice: GetInvoiceUseCase,
  ) {}

  // [Sprint 2.6]: factura PDF de la orden pagada o reembolsada (dueño o ADMIN) | `@Res()`: respuesta binaria con nombre de archivo
  @Get(':id/invoice')
  @ApiOperation({ summary: 'Factura (PDF) de una orden pagada o reembolsada' })
  async invoicePdf(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { filename, pdf } = await this.invoice.execute(user, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(pdf);
  }

  @Post()
  @ApiOperation({
    summary: 'Crear la orden desde el carrito (total calculado en el servidor)',
  })
  createOrder(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrderDto) {
    return this.create.execute(user.sub, dto.courseIds);
  }

  @Get('me')
  @ApiOperation({ summary: 'Mis órdenes con su estado' })
  mine(@CurrentUser() user: JwtPayload) {
    return this.listMine.execute(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una orden (dueño o ADMIN)' })
  detail(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.getOne.execute(user, id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancelar una orden pendiente de pago' })
  cancel(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cancelOne.execute(user.sub, id);
  }
}
